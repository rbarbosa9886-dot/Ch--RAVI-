import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_GIFTS, INITIAL_RESERVATIONS, DEFAULT_EVENT_DETAILS } from './src/data/defaultGifts.ts';
import { Gift, Reservation, EventDetails } from './src/types.ts';
import {
  isSupabaseConfigured,
  autoMigrateData,
  getEventDetailsSupabase,
  updateEventDetailsSupabase,
  getGiftsSupabase,
  createGiftSupabase,
  updateGiftSupabase,
  deleteGiftSupabase,
  makeReservationSupabase,
  getReservationsSupabase,
  cancelReservationSupabase,
  clearAllReservationsSupabase,
  getDashboardStatsSupabase,
} from './server/supabase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// File persistence paths (local fallback & initial seed source)
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
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {}
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

// Simple mutex queue for local concurrency protection fallback
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

// Load initial database from disk
loadDb();

// If Supabase credentials are provided, auto-migrate data without duplicating
if (isSupabaseConfigured()) {
  console.log('[Supabase] Credentials detected. Synchronizing initial data with Supabase...');
  autoMigrateData(db).then((res) => {
    console.log('[Supabase] Auto-migration status:', res.message);
  }).catch((err) => {
    console.error('[Supabase] Auto-migration error:', err);
  });
} else {
  console.log('[Supabase] SUPABASE_URL not configured. Operating in local fallback mode. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use Supabase as the primary persistent database.');
}

// ------------------------------------
// API ROUTES
// ------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    supabaseConnected: isSupabaseConfigured()
  });
});

// Event Info
app.get('/api/event', async (req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const supabaseEvent = await getEventDetailsSupabase();
      if (supabaseEvent) {
        db.eventDetails = supabaseEvent;
        return res.json(supabaseEvent);
      }
    } catch (err) {
      console.error('[API /event GET] Supabase error:', err);
    }
  }
  res.json(db.eventDetails);
});

app.put('/api/event', verifyAdminAuth, async (req, res) => {
  const updates = req.body;

  if (isSupabaseConfigured()) {
    try {
      const saved = await updateEventDetailsSupabase(updates);
      if (saved) {
        db.eventDetails = saved;
        saveDb();
        return res.json(saved);
      }
    } catch (err: any) {
      console.error('[API /event PUT] Supabase error:', err);
      return res.status(500).json({ error: err.message || 'Erro ao atualizar dados no Supabase.' });
    }
  }

  db.eventDetails = {
    ...db.eventDetails,
    ...updates,
    isCustomized: true,
    updatedAt: updates.updatedAt || Date.now()
  };
  saveDb();
  res.json(db.eventDetails);
});

// Full state sync (from Admin client persistence)
app.post('/api/admin/sync-all', verifyAdminAuth, async (req, res) => {
  const { eventDetails, gifts, reservations } = req.body;
  if (eventDetails) {
    db.eventDetails = {
      ...db.eventDetails,
      ...eventDetails,
      isCustomized: true,
      updatedAt: eventDetails.updatedAt || Date.now()
    };
    if (isSupabaseConfigured()) {
      try { await updateEventDetailsSupabase(db.eventDetails); } catch {}
    }
  }
  if (gifts && Array.isArray(gifts) && gifts.length > 0) {
    db.gifts = gifts.map(g => ({ ...g, isCustomized: true, updatedAt: g.updatedAt || Date.now() }));
  }
  if (reservations && Array.isArray(reservations)) {
    db.reservations = reservations;
  }
  saveDb();

  if (isSupabaseConfigured()) {
    try {
      await autoMigrateData(db);
    } catch (err) {
      console.error('[API /admin/sync-all] Supabase sync error:', err);
    }
  }

  console.log(`[DB] Synced data: ${db.gifts.length} gifts, ${db.reservations.length} reservations.`);
  res.json({
    success: true,
    eventDetails: db.eventDetails,
    giftsCount: db.gifts.length,
    reservationsCount: db.reservations.length
  });
});

// Gifts List
app.get('/api/gifts', async (req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const supabaseGifts = await getGiftsSupabase();
      if (supabaseGifts && supabaseGifts.length > 0) {
        db.gifts = supabaseGifts;
        return res.json(supabaseGifts);
      }
    } catch (err) {
      console.error('[API /gifts GET] Supabase error:', err);
    }
  }
  res.json(db.gifts);
});

// Create Gift (Admin)
app.post('/api/gifts', verifyAdminAuth, async (req, res) => {
  const { name, description, category, totalQuantity, imageUrl, suggestedBrand } = req.body;
  if (!name || !category || typeof totalQuantity !== 'number' || totalQuantity < 1) {
    return res.status(400).json({ error: 'Campos obrigatórios inválidos.' });
  }

  if (isSupabaseConfigured()) {
    try {
      const created = await createGiftSupabase({
        name,
        description,
        category,
        totalQuantity,
        imageUrl,
        suggestedBrand,
      });
      db.gifts.unshift(created);
      saveDb();
      return res.status(201).json(created);
    } catch (err: any) {
      console.error('[API /gifts POST] Supabase error:', err);
      return res.status(500).json({ error: err.message || 'Erro ao criar presente no Supabase.' });
    }
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
    suggestedBrand: (suggestedBrand || '').trim() || undefined,
    updatedAt: Date.now(),
    isCustomized: true
  };

  db.gifts.unshift(newGift);
  saveDb();
  res.status(201).json(newGift);
});

// Update Gift (Admin)
app.put('/api/gifts/:id', verifyAdminAuth, async (req, res) => {
  const { id } = req.params;

  if (isSupabaseConfigured()) {
    try {
      const updated = await updateGiftSupabase(id, req.body);
      const idx = db.gifts.findIndex(g => g.id === id);
      if (idx !== -1) db.gifts[idx] = updated;
      else db.gifts.unshift(updated);
      saveDb();
      return res.json(updated);
    } catch (err: any) {
      console.error('[API /gifts/:id PUT] Supabase error:', err);
      return res.status(500).json({ error: err.message || 'Erro ao atualizar presente no Supabase.' });
    }
  }

  const giftIndex = db.gifts.findIndex(g => g.id === id);
  if (giftIndex === -1) {
    return res.status(404).json({ error: 'Presente não encontrado.' });
  }

  const existing = db.gifts[giftIndex];
  const { name, description, category, totalQuantity, imageUrl, suggestedBrand, availableQuantity } = req.body;

  let newTotal = existing.totalQuantity;
  let newAvailable = existing.availableQuantity;

  if (typeof totalQuantity === 'number' && totalQuantity >= 0) {
    const difference = totalQuantity - existing.totalQuantity;
    newTotal = totalQuantity;
    newAvailable = Math.max(0, existing.availableQuantity + difference);
  }

  if (typeof availableQuantity === 'number') {
    newAvailable = Math.min(newTotal, Math.max(0, availableQuantity));
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
    status: newAvailable > 0 ? 'available' : 'depleted',
    updatedAt: Date.now(),
    isCustomized: true
  };

  db.gifts[giftIndex] = updated;
  saveDb();
  res.json(updated);
});

// Delete Gift (Admin)
app.delete('/api/gifts/:id', verifyAdminAuth, async (req, res) => {
  const { id } = req.params;

  if (isSupabaseConfigured()) {
    try {
      await deleteGiftSupabase(id);
      db.gifts = db.gifts.filter(g => g.id !== id);
      saveDb();
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[API /gifts/:id DELETE] Supabase error:', err);
      return res.status(500).json({ error: err.message || 'Erro ao excluir presente do Supabase.' });
    }
  }

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
// Strict concurrency check & quantity support
// ------------------------------------
app.post('/api/reservations', async (req, res) => {
  const { giftId, guestName, message, quantity } = req.body;

  if (!giftId || !guestName || typeof guestName !== 'string' || !guestName.trim()) {
    return res.status(400).json({ error: 'Por favor, informe seu nome para confirmar o presente.' });
  }

  const requestedQty = Math.max(1, parseInt(quantity, 10) || 1);

  // If Supabase is configured, use atomic Supabase reservation (PL/pgSQL with FOR UPDATE)
  if (isSupabaseConfigured()) {
    try {
      const result = await makeReservationSupabase(giftId, guestName, requestedQty, message);
      if (result.success) {
        // Sync local memory cache in background
        if (result.reservation) db.reservations.unshift(result.reservation);
        if (result.updatedGift) {
          const idx = db.gifts.findIndex(g => g.id === giftId);
          if (idx !== -1) {
            db.gifts[idx].availableQuantity = result.updatedGift.availableQuantity;
            db.gifts[idx].status = result.updatedGift.status;
          }
        }
        saveDb();
        return res.status(201).json(result);
      } else {
        return res.status(409).json(result);
      }
    } catch (err: any) {
      console.error('[Reservation Error Supabase]', err);
      return res.status(500).json({ error: 'Erro ao processar a reserva no banco de dados. Tente novamente.' });
    }
  }

  // Fallback: Local AsyncMutex
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
            error: 'Que pena! Todas as unidades deste presente já foram reservadas.',
            code: 'OUT_OF_STOCK'
          }
        };
      }

      if (requestedQty > gift.availableQuantity) {
        return {
          status: 409,
          data: {
            error: `Que pena! Apenas ${gift.availableQuantity} ${gift.availableQuantity === 1 ? 'unidade está disponível' : 'unidades estão disponíveis'} no momento.`,
            code: 'INSUFFICIENT_STOCK'
          }
        };
      }

      // Safe decrement
      gift.availableQuantity -= requestedQty;
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
        quantity: requestedQty,
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
app.get('/api/admin/reservations', verifyAdminAuth, async (req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const supabaseRes = await getReservationsSupabase();
      if (supabaseRes) {
        db.reservations = supabaseRes;
        return res.json(supabaseRes);
      }
    } catch (err) {
      console.error('[API /admin/reservations GET] Supabase error:', err);
    }
  }
  res.json(db.reservations);
});

// Admin: cancel reservation & restore item units
app.post('/api/admin/reservations/:id/cancel', verifyAdminAuth, async (req, res) => {
  const { id } = req.params;

  if (isSupabaseConfigured()) {
    try {
      const result = await cancelReservationSupabase(id);
      if (!result.success) {
        return res.status(400).json({ error: result.error || 'Erro ao cancelar reserva.' });
      }

      // Reload fresh state from Supabase
      const [gifts, reservations] = await Promise.all([
        getGiftsSupabase(),
        getReservationsSupabase()
      ]);
      if (gifts) db.gifts = gifts;
      if (reservations) db.reservations = reservations;
      saveDb();

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[API cancel reservation Supabase]', err);
      return res.status(500).json({ error: err.message || 'Erro ao cancelar reserva no Supabase.' });
    }
  }

  // Local fallback
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

      // Restore quantity on the gift (never exceeding totalQuantity)
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

  // Accept Ravi2026, ravi2026, or configured ADMIN_PASSWORD
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
app.get('/api/admin/stats', async (req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const stats = await getDashboardStatsSupabase();
      if (stats) return res.json(stats);
    } catch (err) {
      console.error('[API /admin/stats] Supabase error:', err);
    }
  }

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

// Supabase Status check endpoint
app.get('/api/admin/supabase-status', verifyAdminAuth, async (req, res) => {
  const configured = isSupabaseConfigured();
  let tableStats: any = null;

  if (configured) {
    try {
      const [gifts, reservations, event] = await Promise.all([
        getGiftsSupabase(),
        getReservationsSupabase(),
        getEventDetailsSupabase(),
      ]);
      tableStats = {
        giftsCount: gifts?.length || 0,
        reservationsCount: reservations?.length || 0,
        eventSaved: !!event,
      };
    } catch (err: any) {
      tableStats = { error: err.message };
    }
  }

  res.json({
    isConfigured: configured,
    supabaseUrl: process.env.SUPABASE_URL ? 'Definido no ambiente' : 'Não configurado',
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
    tableStats,
  });
});

// Explicit migration trigger endpoint (Admin)
app.post('/api/admin/migrate-to-supabase', verifyAdminAuth, async (req, res) => {
  if (!isSupabaseConfigured()) {
    return res.status(400).json({
      error: 'Supabase não está configurado. Preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.',
    });
  }

  try {
    const result = await autoMigrateData(db);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao executar migração.' });
  }
});

// Export full database backup (Admin)
app.get('/api/admin/backup', verifyAdminAuth, async (req, res) => {
  let giftsToExport = db.gifts;
  let reservationsToExport = db.reservations;
  let eventToExport = db.eventDetails;

  if (isSupabaseConfigured()) {
    try {
      const [sGifts, sRes, sEvent] = await Promise.all([
        getGiftsSupabase(),
        getReservationsSupabase(),
        getEventDetailsSupabase()
      ]);
      if (sGifts) giftsToExport = sGifts;
      if (sRes) reservationsToExport = sRes;
      if (sEvent) eventToExport = sEvent;
    } catch {}
  }

  res.json({
    appName: 'Chá do Ravi',
    backupDate: new Date().toISOString(),
    eventDetails: eventToExport,
    gifts: giftsToExport,
    reservations: reservationsToExport,
    stats: {
      totalGifts: giftsToExport.length,
      totalUnits: giftsToExport.reduce((acc, g) => acc + g.totalQuantity, 0),
      availableUnits: giftsToExport.reduce((acc, g) => acc + g.availableQuantity, 0),
      chosenUnits: giftsToExport.reduce((acc, g) => acc + (g.totalQuantity - g.availableQuantity), 0)
    }
  });
});

// Restore backup from uploaded JSON (Admin)
app.post('/api/admin/restore-backup', verifyAdminAuth, async (req, res) => {
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

  if (isSupabaseConfigured()) {
    try {
      await autoMigrateData(db);
    } catch (err) {
      console.error('[API /admin/restore-backup] Supabase error:', err);
    }
  }

  res.json({ success: true, message: 'Backup restaurado com sucesso!' });
});

// Clear all reservations & set 100% available without deleting gifts (Admin)
app.post('/api/admin/clear-reservations', verifyAdminAuth, async (req, res) => {
  if (isSupabaseConfigured()) {
    try {
      await clearAllReservationsSupabase();
    } catch (err) {
      console.error('[API clear-reservations Supabase]', err);
    }
  }

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
app.post('/api/admin/reset-demo', verifyAdminAuth, async (req, res) => {
  db = {
    gifts: [...INITIAL_GIFTS],
    reservations: [...INITIAL_RESERVATIONS],
    eventDetails: { ...DEFAULT_EVENT_DETAILS }
  };
  saveDb();

  if (isSupabaseConfigured()) {
    try {
      await autoMigrateData({
        gifts: INITIAL_GIFTS,
        reservations: INITIAL_RESERVATIONS,
        eventDetails: DEFAULT_EVENT_DETAILS
      });
    } catch (err) {
      console.error('[API reset-demo Supabase]', err);
    }
  }

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

export default app;
export { app };
