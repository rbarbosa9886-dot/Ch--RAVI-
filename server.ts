import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { INITIAL_GIFTS, INITIAL_RESERVATIONS, DEFAULT_EVENT_DETAILS } from './src/data/defaultGifts.ts';
import { Gift, Reservation, EventDetails } from './src/types.ts';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// File persistence paths
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface AppDatabase {
  gifts: Gift[];
  reservations: Reservation[];
  eventDetails: EventDetails;
}

// In-memory cache + file sync
let db: AppDatabase = {
  gifts: [...INITIAL_GIFTS],
  reservations: [...INITIAL_RESERVATIONS],
  eventDetails: { ...DEFAULT_EVENT_DETAILS }
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDb(): void {
  try {
    ensureDataDir();
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.gifts && Array.isArray(parsed.gifts)) {
        db = parsed;
        console.log(`[DB] Loaded ${db.gifts.length} gifts and ${db.reservations.length} reservations from disk.`);
        return;
      }
    }
  } catch (err) {
    console.warn('[DB] Failed to load db.json, using defaults:', err);
  }
  saveDb();
}

function saveDb(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed to save db.json:', err);
  }
}

// Simple mutex queue for atomic concurrency protection
class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(task: () => Promise<T> | T): Promise<T> {
    const next = this.queue.then(() => task());
    this.queue = next.then(() => {}, () => {});
    return next;
  }
}

const reservationMutex = new AsyncMutex();

// Admin auth check helper
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Ravi2026';

function verifyAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '')?.trim();
  if (
    !token ||
    (token !== ADMIN_PASSWORD &&
     token !== 'authenticated-ravi-admin' &&
     token.toLowerCase() !== 'ravi2026')
  ) {
    return res.status(401).json({ error: 'Acesso não autorizado ao painel administrativo.' });
  }
  next();
}

// Load initial database
loadDb();

// ------------------------------------
// API ROUTES
// ------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Event Info
app.get('/api/event', (req, res) => {
  res.json(db.eventDetails);
});

app.put('/api/event', verifyAdminAuth, (req, res) => {
  const updates = req.body;
  db.eventDetails = { ...db.eventDetails, ...updates };
  saveDb();
  res.json(db.eventDetails);
});

// Gifts List
app.get('/api/gifts', (req, res) => {
  res.json(db.gifts);
});

// Create Gift (Admin)
app.post('/api/gifts', verifyAdminAuth, (req, res) => {
  const { name, description, category, totalQuantity, imageUrl, suggestedBrand } = req.body;
  if (!name || !category || typeof totalQuantity !== 'number' || totalQuantity < 1) {
    return res.status(400).json({ error: 'Campos obrigatórios inválidos.' });
  }

  const newGift: Gift = {
    id: 'gift-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    name: name.trim(),
    description: (description || '').trim(),
    category,
    imageUrl: imageUrl?.trim() || 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80',
    totalQuantity,
    availableQuantity: totalQuantity,
    status: 'available',
    createdAt: new Date().toISOString(),
    suggestedBrand: (suggestedBrand || '').trim() || undefined
  };

  db.gifts.unshift(newGift);
  saveDb();
  res.status(201).json(newGift);
});

// Update Gift (Admin)
app.put('/api/gifts/:id', verifyAdminAuth, (req, res) => {
  const { id } = req.params;
  const giftIndex = db.gifts.findIndex(g => g.id === id);
  if (giftIndex === -1) {
    return res.status(404).json({ error: 'Presente não encontrado.' });
  }

  const existing = db.gifts[giftIndex];
  const { name, description, category, totalQuantity, imageUrl, suggestedBrand } = req.body;

  let newTotal = existing.totalQuantity;
  let newAvailable = existing.availableQuantity;

  if (typeof totalQuantity === 'number' && totalQuantity >= 0) {
    const difference = totalQuantity - existing.totalQuantity;
    newTotal = totalQuantity;
    newAvailable = Math.max(0, existing.availableQuantity + difference);
  }

  const updated: Gift = {
    ...existing,
    name: name !== undefined ? name.trim() : existing.name,
    description: description !== undefined ? description.trim() : existing.description,
    category: category || existing.category,
    imageUrl: imageUrl !== undefined ? imageUrl.trim() : existing.imageUrl,
    suggestedBrand: suggestedBrand !== undefined ? suggestedBrand.trim() : existing.suggestedBrand,
    totalQuantity: newTotal,
    availableQuantity: newAvailable,
    status: newAvailable > 0 ? 'available' : 'depleted'
  };

  db.gifts[giftIndex] = updated;
  saveDb();
  res.json(updated);
});

// Delete Gift (Admin)
app.delete('/api/gifts/:id', verifyAdminAuth, (req, res) => {
  const { id } = req.params;
  const giftIndex = db.gifts.findIndex(g => g.id === id);
  if (giftIndex === -1) {
    return res.status(404).json({ error: 'Presente não encontrado.' });
  }

  const deleted = db.gifts.splice(giftIndex, 1)[0];
  saveDb();
  res.json({ success: true, deletedGift: deleted });
});

// ------------------------------------
// ATOMIC RESERVATION ROUTE
// Strict concurrency check
// ------------------------------------
app.post('/api/reservations', async (req, res) => {
  const { giftId, guestName, message } = req.body;

  if (!giftId || !guestName || typeof guestName !== 'string' || !guestName.trim()) {
    return res.status(400).json({ error: 'Por favor, informe seu nome para confirmar o presente.' });
  }

  // Execute atomically via async mutex to avoid race conditions between simultaneous guests
  try {
    const result = await reservationMutex.runExclusive(async () => {
      const gift = db.gifts.find(g => g.id === giftId);
      if (!gift) {
        return { status: 404, data: { error: 'Presente não encontrado.' } };
      }

      if (gift.availableQuantity <= 0) {
        return {
          status: 409,
          data: {
            error: 'Que pena! A última unidade deste presente acabou de ser reservada por outro convidado.',
            code: 'OUT_OF_STOCK'
          }
        };
      }

      // Safe decrement
      gift.availableQuantity -= 1;
      if (gift.availableQuantity <= 0) {
        gift.availableQuantity = 0;
        gift.status = 'depleted';
      }

      const newReservation: Reservation = {
        id: 'res-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        giftId: gift.id,
        giftName: gift.name,
        guestName: guestName.trim(),
        message: message?.trim() || undefined,
        quantity: 1,
        createdAt: new Date().toISOString(),
        status: 'confirmed'
      };

      db.reservations.unshift(newReservation);
      saveDb();

      return {
        status: 201,
        data: {
          success: true,
          reservation: newReservation,
          updatedGift: gift
        }
      };
    });

    return res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[Reservation Error]', err);
    return res.status(500).json({ error: 'Erro ao processar a reserva. Tente novamente.' });
  }
});

// Admin: list all reservations
app.get('/api/admin/reservations', verifyAdminAuth, (req, res) => {
  res.json(db.reservations);
});

// Admin: cancel reservation & restore item unit
app.post('/api/admin/reservations/:id/cancel', verifyAdminAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await reservationMutex.runExclusive(async () => {
      const resIndex = db.reservations.findIndex(r => r.id === id);
      if (resIndex === -1) {
        return { status: 404, data: { error: 'Reserva não encontrada.' } };
      }

      const reservation = db.reservations[resIndex];
      if (reservation.status === 'cancelled') {
        return { status: 400, data: { error: 'Esta reserva já se encontra cancelada.' } };
      }

      reservation.status = 'cancelled';

      // Restore quantity on the gift
      const gift = db.gifts.find(g => g.id === reservation.giftId);
      if (gift) {
        gift.availableQuantity = Math.min(gift.totalQuantity, gift.availableQuantity + reservation.quantity);
        if (gift.availableQuantity > 0) {
          gift.status = 'available';
        }
      }

      saveDb();
      return {
        status: 200,
        data: {
          success: true,
          reservation,
          updatedGift: gift
        }
      };
    });

    return res.status(result.status).json(result.data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao cancelar reserva.' });
  }
});

// Admin: Login endpoint
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Informe a senha de administrador.' });
  }

  const cleanPass = password.trim();

  // Accept Ravi2026, ravi2026 (case-insensitive for convenience & mobile keyboards), or configured ADMIN_PASSWORD
  if (
    cleanPass.toLowerCase() === 'ravi2026' ||
    cleanPass === ADMIN_PASSWORD ||
    cleanPass === ADMIN_PASSWORD.trim()
  ) {
    return res.json({
      success: true,
      token: 'authenticated-ravi-admin',
      message: 'Bem-vindo ao painel do Chá do Ravi!'
    });
  }

  return res.status(401).json({ error: 'Senha incorreta. A senha é Ravi2026.' });
});

// Dashboard stats endpoint
app.get('/api/admin/stats', (req, res) => {
  const totalGifts = db.gifts.length;
  const totalUnits = db.gifts.reduce((acc, g) => acc + g.totalQuantity, 0);
  const availableUnits = db.gifts.reduce((acc, g) => acc + g.availableQuantity, 0);
  const chosenUnits = Math.max(0, totalUnits - availableUnits);
  const completionPercentage = totalUnits > 0 ? Math.round((chosenUnits / totalUnits) * 100) : 0;

  res.json({
    totalGifts,
    totalUnits,
    chosenUnits,
    availableUnits,
    completionPercentage
  });
});

// Export full database backup (Admin)
app.get('/api/admin/backup', verifyAdminAuth, (req, res) => {
  res.json({
    appName: 'Chá do Ravi',
    backupDate: new Date().toISOString(),
    eventDetails: db.eventDetails,
    gifts: db.gifts,
    reservations: db.reservations,
    stats: {
      totalGifts: db.gifts.length,
      totalUnits: db.gifts.reduce((acc, g) => acc + g.totalQuantity, 0),
      availableUnits: db.gifts.reduce((acc, g) => acc + g.availableQuantity, 0),
      chosenUnits: db.gifts.reduce((acc, g) => acc + (g.totalQuantity - g.availableQuantity), 0)
    }
  });
});

// Restore backup from uploaded JSON (Admin)
app.post('/api/admin/restore-backup', verifyAdminAuth, (req, res) => {
  const { gifts, reservations, eventDetails } = req.body;
  if (!Array.isArray(gifts)) {
    return res.status(400).json({ error: 'Arquivo de backup inválido: lista de presentes não encontrada.' });
  }

  db.gifts = gifts;
  if (Array.isArray(reservations)) {
    db.reservations = reservations;
  }
  if (eventDetails && typeof eventDetails === 'object') {
    db.eventDetails = { ...DEFAULT_EVENT_DETAILS, ...eventDetails };
  }
  saveDb();
  res.json({ success: true, message: 'Backup restaurado com sucesso!' });
});

// Clear all reservations & set 100% available without deleting gifts (Admin)
app.post('/api/admin/clear-reservations', verifyAdminAuth, (req, res) => {
  db.reservations = [];
  db.gifts = db.gifts.map(gift => ({
    ...gift,
    availableQuantity: gift.totalQuantity,
    status: 'available'
  }));
  saveDb();
  res.json({
    success: true,
    message: 'Todas as reservas foram zeradas. Todos os presentes voltaram a 100% disponíveis!'
  });
});

// Reset demo data endpoint (Admin)
app.post('/api/admin/reset-demo', verifyAdminAuth, (req, res) => {
  db = {
    gifts: [...INITIAL_GIFTS],
    reservations: [...INITIAL_RESERVATIONS],
    eventDetails: { ...DEFAULT_EVENT_DETAILS }
  };
  saveDb();
  res.json({ success: true, message: 'Dados restaurados para o padrão inicial de demonstração.' });
});

// ------------------------------------
// SERVER START & VITE MIDDLEWARE
// ------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist'))
      ? path.join(process.cwd(), 'dist')
      : path.resolve(__dirname);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Chá do Ravi] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
