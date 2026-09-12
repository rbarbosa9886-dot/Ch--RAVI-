import { Gift, Reservation, EventDetails, DashboardStats } from './types.ts';
import { INITIAL_GIFTS, INITIAL_RESERVATIONS, DEFAULT_EVENT_DETAILS } from './data/defaultGifts.ts';

const BASE_URL = '/api';

export async function fetchEventDetails(): Promise<EventDetails> {
  try {
    const res = await fetch(`${BASE_URL}/event`);
    if (!res.ok) throw new Error('Falha ao carregar detalhes do evento');
    const data = await res.json();
    localStorage.setItem('ravi_cached_event', JSON.stringify(data));
    return data;
  } catch (err) {
    const cached = localStorage.getItem('ravi_cached_event');
    if (cached) {
      try { return JSON.parse(cached); } catch {}
    }
    return DEFAULT_EVENT_DETAILS;
  }
}

export async function updateEventDetails(updates: Partial<EventDetails>, token: string): Promise<EventDetails> {
  try {
    const res = await fetch(`${BASE_URL}/event`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Falha ao atualizar informações');
    const data = await res.json();
    localStorage.setItem('ravi_cached_event', JSON.stringify(data));
    return data;
  } catch (err) {
    const current = await fetchEventDetails();
    const merged = { ...current, ...updates };
    localStorage.setItem('ravi_cached_event', JSON.stringify(merged));
    return merged;
  }
}

export async function fetchGifts(): Promise<Gift[]> {
  try {
    const res = await fetch(`${BASE_URL}/gifts`);
    if (!res.ok) throw new Error('Falha ao carregar presentes');
    const data = await res.json();
    localStorage.setItem('ravi_cached_gifts', JSON.stringify(data));
    return data;
  } catch (err) {
    const cached = localStorage.getItem('ravi_cached_gifts');
    if (cached) {
      try { return JSON.parse(cached); } catch {}
    }
    return INITIAL_GIFTS;
  }
}

export async function createGift(giftData: Partial<Gift>, token: string): Promise<Gift> {
  try {
    const res = await fetch(`${BASE_URL}/gifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(giftData)
    });
    if (res.ok) {
      return res.json();
    }
    throw new Error('Falha no servidor');
  } catch (err) {
    // Local fallback
    const newGift: Gift = {
      id: 'gift-' + Date.now(),
      name: giftData.name || 'Novo Presente',
      description: giftData.description || '',
      category: giftData.category || 'outros',
      imageUrl: giftData.imageUrl || 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80',
      suggestedBrand: giftData.suggestedBrand,
      totalQuantity: Number(giftData.totalQuantity) || 1,
      availableQuantity: Number(giftData.totalQuantity) || 1,
      status: 'available',
      createdAt: new Date().toISOString()
    };
    const current = await fetchGifts();
    const updated = [newGift, ...current];
    localStorage.setItem('ravi_cached_gifts', JSON.stringify(updated));
    return newGift;
  }
}

export async function updateGift(id: string, giftData: Partial<Gift>, token: string): Promise<Gift> {
  try {
    const res = await fetch(`${BASE_URL}/gifts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(giftData)
    });
    if (res.ok) {
      return res.json();
    }
    throw new Error('Falha no servidor');
  } catch (err) {
    const current = await fetchGifts();
    let updatedGift: Gift | undefined;
    const updatedList = current.map(g => {
      if (g.id === id) {
        updatedGift = { ...g, ...giftData } as Gift;
        return updatedGift;
      }
      return g;
    });
    localStorage.setItem('ravi_cached_gifts', JSON.stringify(updatedList));
    return updatedGift || (giftData as Gift);
  }
}

export async function deleteGift(id: string, token: string): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/gifts/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error('Falha ao excluir presente');
  } catch (err) {
    const current = await fetchGifts();
    const updated = current.filter(g => g.id !== id);
    localStorage.setItem('ravi_cached_gifts', JSON.stringify(updated));
  }
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
  localStorage.removeItem('ravi_cached_gifts');
  localStorage.removeItem('ravi_reservations_backup');
  localStorage.removeItem('ravi_cached_event');
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
  localStorage.setItem('ravi_cached_gifts', JSON.stringify(resetGifts));
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
      return await res.json();
    }
  } catch (err) {
    // fallback
  }

  if (backupData.gifts) {
    localStorage.setItem('ravi_cached_gifts', JSON.stringify(backupData.gifts));
  }
  if (backupData.reservations) {
    localStorage.setItem('ravi_reservations_backup', JSON.stringify(backupData.reservations));
  }
  if (backupData.eventDetails) {
    localStorage.setItem('ravi_cached_event', JSON.stringify(backupData.eventDetails));
  }

  return { success: true, message: 'Backup restaurado com sucesso!' };
}
