import { Gift, Reservation, EventDetails, DashboardStats } from './types.ts';

const BASE_URL = '/api';

export async function fetchEventDetails(): Promise<EventDetails> {
  const res = await fetch(`${BASE_URL}/event`);
  if (!res.ok) throw new Error('Falha ao carregar detalhes do evento');
  return res.json();
}

export async function updateEventDetails(updates: Partial<EventDetails>, token: string): Promise<EventDetails> {
  const res = await fetch(`${BASE_URL}/event`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Falha ao atualizar informações do evento');
  return res.json();
}

export async function fetchGifts(): Promise<Gift[]> {
  const res = await fetch(`${BASE_URL}/gifts`);
  if (!res.ok) throw new Error('Falha ao carregar presentes');
  return res.json();
}

export async function createGift(giftData: Partial<Gift>, token: string): Promise<Gift> {
  const res = await fetch(`${BASE_URL}/gifts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(giftData)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao cadastrar presente');
  }
  return res.json();
}

export async function updateGift(id: string, giftData: Partial<Gift>, token: string): Promise<Gift> {
  const res = await fetch(`${BASE_URL}/gifts/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(giftData)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao editar presente');
  }
  return res.json();
}

export async function deleteGift(id: string, token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/gifts/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Falha ao excluir presente');
}

export interface ReservationResult {
  success: boolean;
  reservation?: Reservation;
  updatedGift?: Gift;
  error?: string;
  code?: string;
}

export async function reserveGift(giftId: string, guestName: string, message?: string): Promise<ReservationResult> {
  const res = await fetch(`${BASE_URL}/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ giftId, guestName, message })
  });

  const data = await res.json();
  if (!res.ok) {
    return {
      success: false,
      error: data.error || 'Não foi possível concluir a reserva.',
      code: data.code
    };
  }

  return {
    success: true,
    reservation: data.reservation,
    updatedGift: data.updatedGift
  };
}

export async function fetchAdminReservations(token: string): Promise<Reservation[]> {
  const res = await fetch(`${BASE_URL}/admin/reservations`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Não foi possível carregar as reservas');
  return res.json();
}

export async function cancelReservation(id: string, token: string): Promise<{ success: boolean; updatedGift: Gift }> {
  const res = await fetch(`${BASE_URL}/admin/reservations/${id}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao cancelar reserva');
  }
  return res.json();
}

export async function adminLogin(password: string): Promise<{ success: boolean; token: string }> {
  const res = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Senha incorreta');
  }
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${BASE_URL}/admin/stats`);
  if (!res.ok) throw new Error('Falha ao obter estatísticas');
  return res.json();
}

export async function resetDemoData(token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/admin/reset-demo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Falha ao restaurar demonstração');
}
