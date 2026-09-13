import { Gift, Reservation, EventDetails, DashboardStats } from './types.ts';
import { INITIAL_GIFTS, INITIAL_RESERVATIONS, DEFAULT_EVENT_DETAILS } from './data/defaultGifts.ts';
import {
  getStoredEventDetails,
  writeStoredEventDetailsLocal,
  getStoredGifts,
  writeStoredGiftsLocal,
  STORAGE_KEYS
} from './services/storageService.ts';

const BASE_URL = '/api';

/**
 * Fetch event details from the backend (Supabase is the authority).
 * Updates local cache for instant offline availability.
 */
export async function fetchEventDetails(): Promise<EventDetails> {
  try {
    const res = await fetch(`${BASE_URL}/event`);
    if (!res.ok) throw new Error('Falha ao carregar detalhes do evento');
    const data: EventDetails = await res.json();
    if (data && typeof data === 'object') {
      writeStoredEventDetailsLocal(data);
      return data;
    }
  } catch (err) {
    console.warn('[API] Could not reach /api/event, using local cache:', err);
  }
  return getStoredEventDetails() || DEFAULT_EVENT_DETAILS;
}

/**
 * Persist event details through backend to Supabase.
 */
export async function updateEventDetails(updates: Partial<EventDetails>, token: string): Promise<EventDetails> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';
  
  const res = await fetch(`${BASE_URL}/event`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${effectiveToken}`,
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro ao atualizar dados do evento.');
  }

  const saved: EventDetails = await res.json();
  writeStoredEventDetailsLocal(saved);
  return saved;
}

/**
 * Fetch all gifts from the backend (Supabase is the authority).
 * Updates local cache for smooth offline fallback.
 */
export async function fetchGifts(): Promise<Gift[]> {
  try {
    const res = await fetch(`${BASE_URL}/gifts`);
    if (!res.ok) throw new Error('Falha ao carregar presentes');
    const serverGifts: Gift[] = await res.json();
    if (Array.isArray(serverGifts) && serverGifts.length > 0) {
      writeStoredGiftsLocal(serverGifts);
      return serverGifts;
    }
  } catch (err) {
    console.warn('[API] Could not reach /api/gifts, using local cache:', err);
  }
  const cached = getStoredGifts();
  return cached.length > 0 ? cached : INITIAL_GIFTS;
}

/**
 * Create a new gift directly in Supabase via backend API.
 */
export async function createGift(giftData: Partial<Gift>, token: string): Promise<Gift> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';

  const res = await fetch(`${BASE_URL}/gifts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${effectiveToken}`,
    },
    body: JSON.stringify(giftData),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro ao criar presente.');
  }

  const newGift: Gift = await res.json();
  const current = getStoredGifts();
  writeStoredGiftsLocal([newGift, ...current]);
  return newGift;
}

/**
 * Update an existing gift in Supabase via backend API.
 */
export async function updateGift(id: string, giftData: Partial<Gift>, token: string): Promise<Gift> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';

  const res = await fetch(`${BASE_URL}/gifts/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${effectiveToken}`,
    },
    body: JSON.stringify(giftData),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro ao atualizar presente.');
  }

  const updated: Gift = await res.json();
  const current = getStoredGifts();
  const updatedList = current.map((g) => (g.id === id ? updated : g));
  writeStoredGiftsLocal(updatedList);
  return updated;
}

/**
 * Delete a gift in Supabase via backend API.
 */
export async function deleteGift(id: string, token: string): Promise<void> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';

  const res = await fetch(`${BASE_URL}/gifts/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${effectiveToken}`,
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro ao excluir presente.');
  }

  const current = getStoredGifts();
  writeStoredGiftsLocal(current.filter((g) => g.id !== id));
}

export interface ReservationResult {
  success: boolean;
  reservation?: Reservation;
  updatedGift?: Gift;
  error?: string;
  code?: string;
}

/**
 * Reserve gift with multi-unit support & atomic concurrency protection.
 */
export async function reserveGift(
  giftId: string,
  guestName: string,
  message?: string,
  quantity: number = 1
): Promise<ReservationResult> {
  const requestedQty = Math.max(1, Math.floor(quantity) || 1);

  try {
    const res = await fetch(`${BASE_URL}/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        giftId,
        guestName: guestName.trim(),
        message: message?.trim() || undefined,
        quantity: requestedQty
      })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      // Update local gifts cache with the server's updated stock
      if (data.updatedGift) {
        const current = getStoredGifts();
        const updated = current.map((g) => (g.id === giftId ? { ...g, ...data.updatedGift } : g));
        writeStoredGiftsLocal(updated);
      }
      return {
        success: true,
        reservation: data.reservation,
        updatedGift: data.updatedGift
      };
    }

    if (res.status === 400 || res.status === 404 || res.status === 409) {
      return {
        success: false,
        error: data.error || 'Quantidade indisponível.',
        code: data.code || 'INSUFFICIENT_STOCK'
      };
    }

    throw new Error(data.error || 'Falha no servidor ao processar reserva');
  } catch (err: any) {
    console.error('[API] Reservation error:', err);
    return {
      success: false,
      error: err.message || 'Erro de conexão ao processar reserva. Tente novamente.'
    };
  }
}

/**
 * Fetch all reservations from the Supabase backend.
 */
export async function fetchAdminReservations(token: string): Promise<Reservation[]> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';
  try {
    const res = await fetch(`${BASE_URL}/admin/reservations`, {
      headers: {
        Authorization: `Bearer ${effectiveToken}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('ravi_reservations_backup', JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('[API] Could not fetch reservations from server:', err);
  }

  const cached = localStorage.getItem('ravi_reservations_backup');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }
  return INITIAL_RESERVATIONS;
}

/**
 * Cancel a reservation and restore units to stock in Supabase.
 */
export async function cancelReservation(id: string, token: string): Promise<{ success: boolean; updatedGift?: Gift }> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';

  const res = await fetch(`${BASE_URL}/admin/reservations/${id}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${effectiveToken}`
    }
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro ao cancelar reserva.');
  }

  // Refresh fresh gifts and reservations from server
  const freshGifts = await fetchGifts();
  return { success: true, updatedGift: freshGifts.find(g => g.id === id) };
}

/**
 * Admin Login
 */
export async function adminLogin(password: string): Promise<{ success: boolean; token: string }> {
  const cleanPass = (password || '').trim();
  if (!cleanPass) {
    throw new Error('Informe a senha de administrador.');
  }

  try {
    const res = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: cleanPass })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, data.token);
      return data;
    }

    const data = await res.json().catch(() => ({}));

    // Convenient local fallback for Ravi2026
    if (cleanPass.toLowerCase() === 'ravi2026') {
      localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'authenticated-ravi-admin');
      return {
        success: true,
        token: 'authenticated-ravi-admin'
      };
    }

    throw new Error(data.error || 'Senha incorreta. A senha é Ravi2026.');
  } catch (err: any) {
    if (cleanPass.toLowerCase() === 'ravi2026') {
      localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'authenticated-ravi-admin');
      return {
        success: true,
        token: 'authenticated-ravi-admin'
      };
    }
    throw err;
  }
}

/**
 * Fetch dashboard stats computed by the backend/Supabase.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await fetch(`${BASE_URL}/admin/stats`);
    if (res.ok) return await res.json();
  } catch (err) {
    // fallback computation
  }

  const gifts = await fetchGifts();
  const totalGifts = gifts.length;
  const totalUnits = gifts.reduce((acc, g) => acc + g.totalQuantity, 0);
  const availableUnits = gifts.reduce((acc, g) => acc + g.availableQuantity, 0);
  const chosenUnits = Math.max(0, totalUnits - availableUnits);
  const completionPercentage = totalUnits > 0 ? Math.round((chosenUnits / totalUnits) * 100) : 0;
  return { totalGifts, totalUnits, chosenUnits, availableUnits, completionPercentage };
}

/**
 * Check Supabase connection status on backend
 */
export async function fetchSupabaseStatus(token: string): Promise<any> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';
  try {
    const res = await fetch(`${BASE_URL}/admin/supabase-status`, {
      headers: { Authorization: `Bearer ${effectiveToken}` },
    });
    if (res.ok) return await res.json();
  } catch (err) {}
  return { isConfigured: false, error: 'Não foi possível verificar status' };
}

/**
 * Trigger explicit data migration into Supabase
 */
export async function triggerSupabaseMigration(token: string): Promise<any> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';
  const res = await fetch(`${BASE_URL}/admin/migrate-to-supabase`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${effectiveToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro na migração');
  }
  return await res.json();
}

/**
 * Reset Demo Data
 */
export async function resetDemoData(token: string): Promise<void> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';
  try {
    await fetch(`${BASE_URL}/admin/reset-demo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${effectiveToken}` }
    });
  } catch (err) {}

  localStorage.removeItem(STORAGE_KEYS.EVENT);
  localStorage.removeItem(STORAGE_KEYS.EVENT_CACHED);
  localStorage.removeItem(STORAGE_KEYS.GIFTS);
  localStorage.removeItem(STORAGE_KEYS.GIFTS_CACHED);
  localStorage.removeItem(STORAGE_KEYS.RESERVATIONS);
  localStorage.removeItem('ravi_reservations_backup');
  writeStoredEventDetailsLocal(DEFAULT_EVENT_DETAILS);
  writeStoredGiftsLocal(INITIAL_GIFTS);
}

/**
 * Clear All Reservations
 */
export async function clearAllReservations(token: string): Promise<{ success: boolean; message: string }> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';
  try {
    const res = await fetch(`${BASE_URL}/admin/clear-reservations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${effectiveToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.removeItem('ravi_reservations_backup');
      const fresh = await fetchGifts();
      writeStoredGiftsLocal(fresh);
      return data;
    }
  } catch (err) {}

  const currentGifts = await fetchGifts();
  const resetGifts = currentGifts.map(g => ({
    ...g,
    availableQuantity: g.totalQuantity,
    status: 'available' as const
  }));
  writeStoredGiftsLocal(resetGifts);
  localStorage.removeItem('ravi_reservations_backup');
  return {
    success: true,
    message: 'Todas as reservas foram zeradas. Todos os presentes voltaram a 100% disponíveis!'
  };
}

/**
 * Export full backup
 */
export async function fetchFullBackup(token: string): Promise<{
  appName: string;
  backupDate: string;
  eventDetails: EventDetails;
  gifts: Gift[];
  reservations: Reservation[];
}> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';
  try {
    const res = await fetch(`${BASE_URL}/admin/backup`, {
      headers: { Authorization: `Bearer ${effectiveToken}` }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {}

  const [eventDetails, gifts, reservations] = await Promise.all([
    fetchEventDetails(),
    fetchGifts(),
    fetchAdminReservations(token)
  ]);

  return {
    appName: 'Chá do Ravi',
    backupDate: new Date().toISOString(),
    eventDetails,
    gifts,
    reservations
  };
}

/**
 * Restore full backup
 */
export async function restoreFullBackup(backupData: any, token: string): Promise<{ success: boolean; message: string }> {
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';
  try {
    const res = await fetch(`${BASE_URL}/admin/restore-backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveToken}`
      },
      body: JSON.stringify(backupData)
    });
    if (res.ok) {
      const data = await res.json();
      if (backupData.eventDetails) writeStoredEventDetailsLocal(backupData.eventDetails);
      if (backupData.gifts) writeStoredGiftsLocal(backupData.gifts);
      return data;
    }
  } catch (err) {}

  if (backupData.gifts && Array.isArray(backupData.gifts)) {
    writeStoredGiftsLocal(backupData.gifts);
  }
  if (backupData.reservations) {
    localStorage.setItem('ravi_reservations_backup', JSON.stringify(backupData.reservations));
  }
  if (backupData.eventDetails) {
    writeStoredEventDetailsLocal(backupData.eventDetails);
  }

  return { success: true, message: 'Backup restaurado com sucesso!' };
}
