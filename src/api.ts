import { Gift, Reservation, EventDetails, DashboardStats } from './types.ts';
import { INITIAL_GIFTS, INITIAL_RESERVATIONS, DEFAULT_EVENT_DETAILS } from './data/defaultGifts.ts';
import {
  getStoredEventDetails,
  writeStoredEventDetailsLocal,
  autoSaveEventDetails,
  getStoredGifts,
  writeStoredGiftsLocal,
  autoSaveGifts,
  autoSaveSingleGift,
  autoDeleteGift,
  STORAGE_KEYS
} from './services/storageService.ts';

const BASE_URL = '/api';

export async function fetchEventDetails(): Promise<EventDetails> {
  const localCustom = getStoredEventDetails();
  try {
    const res = await fetch(`${BASE_URL}/event`);
    if (!res.ok) throw new Error('Falha ao carregar detalhes do evento');
    const data: EventDetails = await res.json();

    // If server has customized data, sync it locally
    if (data.isCustomized) {
      writeStoredEventDetailsLocal(data);
      return data;
    }

    // If the server returned default template (e.g. cold container start)
    // but the client previously customized it, keep the user's custom details and re-sync!
    if (localCustom && localCustom.isCustomized) {
      autoSaveEventDetails(localCustom, null, { immediate: true });
      return localCustom;
    }

    writeStoredEventDetailsLocal(data);
    return data;
  } catch (err) {
    return localCustom || DEFAULT_EVENT_DETAILS;
  }
}

export async function updateEventDetails(updates: Partial<EventDetails>, token: string): Promise<EventDetails> {
  return autoSaveEventDetails(updates, token, { immediate: true });
}

export async function fetchGifts(): Promise<Gift[]> {
  const localGifts = getStoredGifts();
  try {
    const res = await fetch(`${BASE_URL}/gifts`);
    if (!res.ok) throw new Error('Falha ao carregar presentes');
    const serverGifts: Gift[] = await res.json();

    const serverHasCustom = serverGifts.some(g => g.isCustomized);

    // If server has custom gifts, update local
    if (serverHasCustom) {
      writeStoredGiftsLocal(serverGifts);
      return serverGifts;
    }

    // If server returned default template but client has customized gifts list, re-sync to server
    if (localGifts && localGifts.some(g => g.isCustomized)) {
      autoSaveGifts(localGifts, null);
      return localGifts;
    }

    writeStoredGiftsLocal(serverGifts);
    return serverGifts;
  } catch (err) {
    return localGifts.length > 0 ? localGifts : INITIAL_GIFTS;
  }
}

export async function createGift(giftData: Partial<Gift>, token: string): Promise<Gift> {
  return autoSaveSingleGift(giftData, token);
}

export async function updateGift(id: string, giftData: Partial<Gift>, token: string): Promise<Gift> {
  return autoSaveSingleGift(giftData, token, id);
}

export async function deleteGift(id: string, token: string): Promise<void> {
  return autoDeleteGift(id, token);
}

export interface ReservationResult {
  success: boolean;
  reservation?: Reservation;
  updatedGift?: Gift;
  error?: string;
  code?: string;
}

export async function reserveGift(giftId: string, guestName: string, message?: string): Promise<ReservationResult> {
  try {
    const res = await fetch(`${BASE_URL}/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ giftId, guestName, message })
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        reservation: data.reservation,
        updatedGift: data.updatedGift
      };
    }

    const data = await res.json().catch(() => ({}));
    if (res.status === 400 || res.status === 404 || res.status === 409) {
      if (data.error) {
        return {
          success: false,
          error: data.error,
          code: data.code
        };
      }
    }
    throw new Error('Falha no servidor');
  } catch (err: any) {
    // Client-side fallback if backend is offline or static
    const gifts = await fetchGifts();
    const gift = gifts.find(g => g.id === giftId);
    if (!gift || gift.availableQuantity <= 0) {
      return {
        success: false,
        error: 'Que pena! Este item acabou de ser escolhido por outro convidado.',
        code: 'OUT_OF_STOCK'
      };
    }

    gift.availableQuantity = Math.max(0, gift.availableQuantity - 1);
    if (gift.availableQuantity === 0) gift.status = 'depleted';

    const newRes: Reservation = {
      id: 'res-' + Date.now(),
      giftId: gift.id,
      giftName: gift.name,
      guestName: guestName.trim(),
      message: message?.trim(),
      quantity: 1,
      createdAt: new Date().toISOString(),
      status: 'confirmed'
    };

    localStorage.setItem('ravi_cached_gifts', JSON.stringify(gifts));
    const cachedRes = JSON.parse(localStorage.getItem('ravi_reservations_backup') || '[]');
    localStorage.setItem('ravi_reservations_backup', JSON.stringify([newRes, ...cachedRes]));

    return {
      success: true,
      reservation: newRes,
      updatedGift: gift
    };
  }
}

export async function fetchAdminReservations(token: string): Promise<Reservation[]> {
  try {
    const res = await fetch(`${BASE_URL}/admin/reservations`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('ravi_reservations_backup', JSON.stringify(data));
      return data;
    }
    throw new Error('Falha ao carregar');
  } catch (err) {
    const cached = localStorage.getItem('ravi_reservations_backup');
    if (cached) {
      try { return JSON.parse(cached); } catch {}
    }
    return INITIAL_RESERVATIONS;
  }
}

export async function cancelReservation(id: string, token: string): Promise<{ success: boolean; updatedGift?: Gift }> {
  try {
    const res = await fetch(`${BASE_URL}/admin/reservations/${id}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (res.ok) {
      return res.json();
    }
    throw new Error('Falha no servidor');
  } catch (err) {
    const cachedRes: Reservation[] = JSON.parse(localStorage.getItem('ravi_reservations_backup') || '[]');
    const updated = cachedRes.map(r => r.id === id ? { ...r, status: 'cancelled' as const } : r);
    localStorage.setItem('ravi_reservations_backup', JSON.stringify(updated));
    return { success: true };
  }
}

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
      return await res.json();
    }

    // If server responded with error
    const data = await res.json().catch(() => ({}));

    // If user provided Ravi2026 (case-insensitive for convenience)
    if (cleanPass.toLowerCase() === 'ravi2026') {
      return {
        success: true,
        token: 'authenticated-ravi-admin'
      };
    }

    throw new Error(data.error || 'Senha incorreta. A senha é Ravi2026.');
  } catch (err: any) {
    // If network error, 404 (static deployment), or fetch failed
    if (cleanPass.toLowerCase() === 'ravi2026') {
      return {
        success: true,
        token: 'authenticated-ravi-admin'
      };
    }
    throw err;
  }
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await fetch(`${BASE_URL}/admin/stats`);
    if (res.ok) return await res.json();
    throw new Error('Falha ao obter');
  } catch (err) {
    const gifts = await fetchGifts();
    const totalGifts = gifts.length;
    const totalUnits = gifts.reduce((acc, g) => acc + g.totalQuantity, 0);
    const availableUnits = gifts.reduce((acc, g) => acc + g.availableQuantity, 0);
    const chosenUnits = Math.max(0, totalUnits - availableUnits);
    const completionPercentage = totalUnits > 0 ? Math.round((chosenUnits / totalUnits) * 100) : 0;
    return { totalGifts, totalUnits, chosenUnits, availableUnits, completionPercentage };
  }
}

export async function resetDemoData(token: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/admin/reset-demo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    // ignore
  }
  localStorage.removeItem(STORAGE_KEYS.EVENT);
  localStorage.removeItem(STORAGE_KEYS.EVENT_CACHED);
  localStorage.removeItem(STORAGE_KEYS.GIFTS);
  localStorage.removeItem(STORAGE_KEYS.GIFTS_CACHED);
  localStorage.removeItem(STORAGE_KEYS.RESERVATIONS);
  localStorage.removeItem('ravi_reservations_backup');
  writeStoredEventDetailsLocal(DEFAULT_EVENT_DETAILS);
  writeStoredGiftsLocal(INITIAL_GIFTS);
}

export async function clearAllReservations(token: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin/clear-reservations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.removeItem('ravi_reservations_backup');
      return data;
    }
  } catch (err) {
    // fallback
  }

  // Local fallback: clear reservations and reset available quantities of current gifts
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

export async function fetchFullBackup(token: string): Promise<{
  appName: string;
  backupDate: string;
  eventDetails: EventDetails;
  gifts: Gift[];
  reservations: Reservation[];
}> {
  try {
    const res = await fetch(`${BASE_URL}/admin/backup`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // fallback
  }

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

export async function restoreFullBackup(backupData: any, token: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin/restore-backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(backupData)
    });
    if (res.ok) {
      const data = await res.json();
      if (backupData.eventDetails) writeStoredEventDetailsLocal(backupData.eventDetails);
      if (backupData.gifts) writeStoredGiftsLocal(backupData.gifts);
      return data;
    }
  } catch (err) {
    // fallback
  }

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
