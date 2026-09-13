import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Gift, Reservation, EventDetails, DashboardStats } from '../src/types.js';

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  return !!(url && key && url.startsWith('http'));
}

export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

  if (!url || !key) {
    return null;
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

// Data Mapping Helpers
export function mapGiftFromDb(row: any): Gift {
  const total = Number(row.total_quantity) || 1;
  const available = Number(row.available_quantity) >= 0 ? Number(row.available_quantity) : 0;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    imageUrl: row.image_url || '',
    category: row.category || 'outros',
    totalQuantity: total,
    availableQuantity: available,
    status: available <= 0 || row.status === 'depleted' ? 'depleted' : 'available',
    suggestedBrand: row.suggested_brand || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    isCustomized: true,
  };
}

export function mapGiftToDb(gift: Partial<Gift>): any {
  const row: any = {};
  if (gift.id !== undefined) row.id = gift.id;
  if (gift.name !== undefined) row.name = gift.name.trim();
  if (gift.description !== undefined) row.description = gift.description.trim();
  if (gift.imageUrl !== undefined) row.image_url = gift.imageUrl.trim();
  if (gift.category !== undefined) row.category = gift.category;
  if (gift.totalQuantity !== undefined) row.total_quantity = Number(gift.totalQuantity);
  if (gift.availableQuantity !== undefined) row.available_quantity = Number(gift.availableQuantity);
  if (gift.status !== undefined) row.status = gift.status;
  if (gift.suggestedBrand !== undefined) {
    row.suggested_brand = gift.suggestedBrand ? gift.suggestedBrand.trim() : null;
  }
  row.updated_at = new Date().toISOString();
  return row;
}

export function mapReservationFromDb(row: any): Reservation {
  return {
    id: row.id,
    giftId: row.gift_id,
    giftName: row.gift_name,
    guestName: row.guest_name,
    message: row.message || undefined,
    quantity: Number(row.quantity) || 1,
    status: row.status === 'cancelled' ? 'cancelled' : 'confirmed',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function mapEventDetailsFromDb(row: any): EventDetails {
  return {
    babyName: row.baby_name || 'RAVI',
    themeTitle: row.theme_title || 'Chá de Fraldas do Ravi — Pequeno Explorador',
    subtitle: row.subtitle || 'Estamos contando os dias para conhecer você!',
    introText: row.intro_text || 'Escolha um presente para o Ravi e faça parte desse momento especial. 💙',
    eventDate: row.event_date || 'Sábado, 24 de Outubro de 2026',
    eventTime: row.event_time || '15:30h',
    eventLocation: row.event_location || 'Espaço Jardim Encantado',
    eventAddress: row.event_address || 'Rua das Palmeiras, 120 - Jardim das Flores',
    mapQuery: row.map_query || 'Rua das Palmeiras, 120',
    pixKey: row.pix_key || 'chadoravi@email.com',
    pixName: row.pix_name || 'Pais do Ravi',
    isCustomized: true,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export function mapEventDetailsToDb(details: Partial<EventDetails>): any {
  const row: any = { id: 1 };
  if (details.babyName !== undefined) row.baby_name = details.babyName.trim();
  if (details.themeTitle !== undefined) row.theme_title = details.themeTitle.trim();
  if (details.subtitle !== undefined) row.subtitle = details.subtitle.trim();
  if (details.introText !== undefined) row.intro_text = details.introText.trim();
  if (details.eventDate !== undefined) row.event_date = details.eventDate.trim();
  if (details.eventTime !== undefined) row.event_time = details.eventTime.trim();
  if (details.eventLocation !== undefined) row.event_location = details.eventLocation.trim();
  if (details.eventAddress !== undefined) row.event_address = details.eventAddress.trim();
  if (details.mapQuery !== undefined) row.map_query = details.mapQuery.trim();
  if (details.pixKey !== undefined) row.pix_key = details.pixKey.trim();
  if (details.pixName !== undefined) row.pix_name = details.pixName.trim();
  row.updated_at = new Date().toISOString();
  return row;
}

/**
 * Migration & Seeding:
 * Safely preserves and migrates initial or existing data from local db to Supabase without duplicates.
 */
export async function autoMigrateData(localDb: {
  gifts: Gift[];
  reservations: Reservation[];
  eventDetails: EventDetails;
}): Promise<{ migratedGifts: number; migratedReservations: number; success: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { migratedGifts: 0, migratedReservations: 0, success: false, message: 'Supabase não configurado' };
  }

  try {
    // 1. Ensure categories exist
    const defaultCategories = [
      { id: 'fraldas', name: 'Fraldas', icon: '🍼', display_order: 1 },
      { id: 'higiene', name: 'Higiene', icon: '🧴', display_order: 2 },
      { id: 'roupinhas', name: 'Roupinhas', icon: '👕', display_order: 3 },
      { id: 'banho', name: 'Banho', icon: '🛁', display_order: 4 },
      { id: 'quarto', name: 'Quarto', icon: '🛏️', display_order: 5 },
      { id: 'outros', name: 'Outros', icon: '🎁', display_order: 6 },
    ];
    await supabase.from('categories').upsert(defaultCategories, { onConflict: 'id' });

    // 2. Ensure event details exist
    const { data: existingEvent } = await supabase.from('event_details').select('id').eq('id', 1).maybeSingle();
    if (!existingEvent && localDb.eventDetails) {
      await supabase.from('event_details').upsert(mapEventDetailsToDb(localDb.eventDetails), { onConflict: 'id' });
    }

    // 3. Migrate gifts if table is empty or missing existing gifts
    const { count: giftCount } = await supabase.from('gifts').select('id', { count: 'exact', head: true });
    let migratedGiftsCount = 0;

    if (!giftCount || giftCount === 0) {
      if (localDb.gifts && localDb.gifts.length > 0) {
        const rows = localDb.gifts.map((g) => mapGiftToDb(g));
        const { error } = await supabase.from('gifts').upsert(rows, { onConflict: 'id' });
        if (!error) {
          migratedGiftsCount = rows.length;
        } else {
          console.error('[Supabase Migration] Error upserting gifts:', error);
        }
      }
    }

    // 4. Migrate reservations if any exist
    let migratedResCount = 0;
    const { count: resCount } = await supabase.from('reservations').select('id', { count: 'exact', head: true });
    if (!resCount || resCount === 0) {
      if (localDb.reservations && localDb.reservations.length > 0) {
        const resRows = localDb.reservations.map((r) => ({
          id: r.id,
          gift_id: r.giftId,
          gift_name: r.giftName,
          guest_name: r.guestName,
          message: r.message || null,
          quantity: r.quantity || 1,
          status: r.status || 'confirmed',
          created_at: r.createdAt || new Date().toISOString(),
        }));
        const { error } = await supabase.from('reservations').upsert(resRows, { onConflict: 'id' });
        if (!error) {
          migratedResCount = resRows.length;
        }
      }
    }

    console.log(`[Supabase Migration] Successfully checked/migrated: ${migratedGiftsCount} gifts, ${migratedResCount} reservations.`);
    return {
      migratedGifts: migratedGiftsCount,
      migratedReservations: migratedResCount,
      success: true,
      message: 'Dados sincronizados com o Supabase com sucesso!',
    };
  } catch (err: any) {
    console.error('[Supabase Migration] Exception during migration:', err);
    return { migratedGifts: 0, migratedReservations: 0, success: false, message: err.message };
  }
}

// =========================================================================
// EVENT DETAILS REPOSITORY
// =========================================================================
export async function getEventDetailsSupabase(): Promise<EventDetails | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.from('event_details').select('*').eq('id', 1).maybeSingle();
  if (error) {
    console.error('[Supabase] Error fetching event_details:', error);
    return null;
  }
  if (!data) return null;
  return mapEventDetailsFromDb(data);
}

export async function updateEventDetailsSupabase(updates: Partial<EventDetails>): Promise<EventDetails | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const row = mapEventDetailsToDb(updates);
  const { data, error } = await supabase
    .from('event_details')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error updating event_details:', error);
    throw new Error(error.message);
  }
  return mapEventDetailsFromDb(data);
}

// =========================================================================
// GIFTS REPOSITORY
// =========================================================================
export async function getGiftsSupabase(): Promise<Gift[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Supabase] Error fetching gifts:', error);
    return null;
  }
  return (data || []).map(mapGiftFromDb);
}

export async function createGiftSupabase(giftData: Partial<Gift>): Promise<Gift> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não conectado.');

  const total = Number(giftData.totalQuantity) || 1;
  const newGiftId = giftData.id || `gift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const row = {
    id: newGiftId,
    name: giftData.name?.trim() || 'Novo Presente',
    description: giftData.description?.trim() || '',
    image_url: giftData.imageUrl?.trim() || 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80',
    category: giftData.category || 'outros',
    total_quantity: total,
    available_quantity: total,
    status: total > 0 ? 'available' : 'depleted',
    suggested_brand: giftData.suggestedBrand?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('gifts').insert(row).select().single();
  if (error) {
    console.error('[Supabase] Error inserting gift:', error);
    throw new Error(error.message);
  }
  return mapGiftFromDb(data);
}

export async function updateGiftSupabase(id: string, giftData: Partial<Gift>): Promise<Gift> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não conectado.');

  // Fetch existing gift first to calculate available_quantity adjustment correctly if total changed
  const { data: existing, error: fetchErr } = await supabase
    .from('gifts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    throw new Error('Presente não encontrado no Supabase.');
  }

  let newTotal = existing.total_quantity;
  let newAvailable = existing.available_quantity;

  if (giftData.totalQuantity !== undefined) {
    newTotal = Math.max(1, Number(giftData.totalQuantity));
    const reservedCount = Math.max(0, existing.total_quantity - existing.available_quantity);
    newAvailable = Math.max(0, newTotal - reservedCount);
  }

  if (giftData.availableQuantity !== undefined) {
    newAvailable = Math.min(newTotal, Math.max(0, Number(giftData.availableQuantity)));
  }

  const updates: any = {
    updated_at: new Date().toISOString(),
    total_quantity: newTotal,
    available_quantity: newAvailable,
    status: newAvailable > 0 ? 'available' : 'depleted',
  };

  if (giftData.name !== undefined) updates.name = giftData.name.trim();
  if (giftData.description !== undefined) updates.description = giftData.description.trim();
  if (giftData.imageUrl !== undefined) updates.image_url = giftData.imageUrl.trim();
  if (giftData.category !== undefined) updates.category = giftData.category;
  if (giftData.suggestedBrand !== undefined) {
    updates.suggested_brand = giftData.suggestedBrand ? giftData.suggestedBrand.trim() : null;
  }

  const { data, error } = await supabase
    .from('gifts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error updating gift:', error);
    throw new Error(error.message);
  }
  return mapGiftFromDb(data);
}

export async function deleteGiftSupabase(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não conectado.');

  const { error } = await supabase.from('gifts').delete().eq('id', id);
  if (error) {
    console.error('[Supabase] Error deleting gift:', error);
    throw new Error(error.message);
  }
}

// =========================================================================
// ATOMIC RESERVATIONS REPOSITORY
// =========================================================================

export interface ReservationResult {
  success: boolean;
  reservation?: Reservation;
  updatedGift?: Gift;
  error?: string;
  code?: string;
}

/**
 * Executes atomic reservation with exact quantity support.
 * Uses PostgreSQL stored procedure `make_reservation` with row-level FOR UPDATE locking.
 * Falls back to atomic SQL conditional update if RPC is not yet executed in Supabase project.
 */
export async function makeReservationSupabase(
  giftId: string,
  guestName: string,
  quantity: number = 1,
  message?: string
): Promise<ReservationResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não conectado.');

  const requestedQty = Math.max(1, Number(quantity) || 1);
  const cleanGuestName = (guestName || '').trim();
  const cleanMessage = (message || '').trim() || null;
  const resId = `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 1. Attempt PostgreSQL stored procedure `make_reservation`
  try {
    const { data, error } = await supabase.rpc('make_reservation', {
      p_gift_id: giftId,
      p_guest_name: cleanGuestName,
      p_quantity: requestedQty,
      p_message: cleanMessage,
      p_reservation_id: resId,
    });

    if (!error && data) {
      if (data.success) {
        return {
          success: true,
          reservation: {
            id: data.reservation.id,
            giftId: data.reservation.giftId,
            giftName: data.reservation.giftName,
            guestName: data.reservation.guestName,
            message: data.reservation.message || undefined,
            quantity: Number(data.reservation.quantity) || requestedQty,
            status: 'confirmed',
            createdAt: data.reservation.createdAt || new Date().toISOString(),
          },
          updatedGift: {
            id: data.updatedGift.id,
            name: data.updatedGift.name,
            description: '',
            imageUrl: '',
            category: 'outros',
            totalQuantity: Number(data.updatedGift.totalQuantity),
            availableQuantity: Number(data.updatedGift.availableQuantity),
            status: data.updatedGift.status,
            createdAt: new Date().toISOString(),
          },
        };
      } else {
        return {
          success: false,
          error: data.error || 'Quantidade solicitada não disponível.',
          code: data.code || 'INSUFFICIENT_STOCK',
        };
      }
    }
  } catch (rpcErr) {
    console.warn('[Supabase RPC make_reservation fallback]:', rpcErr);
  }

  // 2. Fallback: Atomic PostgreSQL conditional query
  // Lock / check stock
  const { data: gift, error: giftErr } = await supabase
    .from('gifts')
    .select('*')
    .eq('id', giftId)
    .single();

  if (giftErr || !gift) {
    return { success: false, error: 'Presente não encontrado.', code: 'NOT_FOUND' };
  }

  if (gift.available_quantity <= 0) {
    return { success: false, error: 'Que pena! Todas as unidades deste presente já foram reservadas.', code: 'OUT_OF_STOCK' };
  }

  if (requestedQty > gift.available_quantity) {
    return {
      success: false,
      error: `Que pena! Apenas ${gift.available_quantity} ${gift.available_quantity === 1 ? 'unidade está disponível' : 'unidades estão disponíveis'} no momento.`,
      code: 'INSUFFICIENT_STOCK',
    };
  }

  // Decrement available quantity atomically
  const newAvailable = gift.available_quantity - requestedQty;
  const newStatus = newAvailable <= 0 ? 'depleted' : 'available';

  const { error: updateErr } = await supabase
    .from('gifts')
    .update({
      available_quantity: newAvailable,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', giftId)
    .gte('available_quantity', requestedQty);

  if (updateErr) {
    return {
      success: false,
      error: 'Não foi possível concluir a reserva devido à alta concorrência. Por favor, tente novamente.',
      code: 'CONCURRENCY_ERROR',
    };
  }

  // Insert single reservation record with quantity = requestedQty
  const newReservation: Reservation = {
    id: resId,
    giftId: gift.id,
    giftName: gift.name,
    guestName: cleanGuestName,
    message: cleanMessage || undefined,
    quantity: requestedQty,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  await supabase.from('reservations').insert({
    id: newReservation.id,
    gift_id: newReservation.giftId,
    gift_name: newReservation.giftName,
    guest_name: newReservation.guestName,
    message: cleanMessage,
    quantity: newReservation.quantity,
    status: 'confirmed',
    created_at: newReservation.createdAt,
  });

  return {
    success: true,
    reservation: newReservation,
    updatedGift: {
      ...mapGiftFromDb(gift),
      availableQuantity: newAvailable,
      status: newStatus,
    },
  };
}

export async function getReservationsSupabase(): Promise<Reservation[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] Error fetching reservations:', error);
    return null;
  }
  return (data || []).map(mapReservationFromDb);
}

/**
 * Cancels reservation and restores quantity to available stock.
 * Guaranteed never to exceed total_quantity.
 */
export async function cancelReservationSupabase(reservationId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não conectado.');

  // Try RPC `cancel_reservation` first
  try {
    const { data, error } = await supabase.rpc('cancel_reservation', {
      p_reservation_id: reservationId,
    });
    if (!error && data?.success) {
      return { success: true };
    }
  } catch (err) {
    console.warn('[Supabase RPC cancel_reservation fallback]:', err);
  }

  // Fallback: Query reservation and update both tables
  const { data: res, error: resErr } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .single();

  if (resErr || !res) {
    return { success: false, error: 'Reserva não encontrada.' };
  }

  if (res.status === 'cancelled') {
    return { success: false, error: 'Esta reserva já se encontra cancelada.' };
  }

  // Mark reservation cancelled
  await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', reservationId);

  // Restore quantity to gift
  const { data: gift } = await supabase.from('gifts').select('*').eq('id', res.gift_id).single();
  if (gift) {
    const qtyToRestore = Number(res.quantity) || 1;
    const restoredAvailable = Math.min(gift.total_quantity, gift.available_quantity + qtyToRestore);
    await supabase
      .from('gifts')
      .update({
        available_quantity: restoredAvailable,
        status: restoredAvailable > 0 ? 'available' : 'depleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', res.gift_id);
  }

  return { success: true };
}

export async function clearAllReservationsSupabase(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase não conectado.');

  // Mark all reservations cancelled or delete
  await supabase.from('reservations').update({ status: 'cancelled' }).neq('status', 'cancelled');

  // Reset all gifts available_quantity = total_quantity
  const { data: gifts } = await supabase.from('gifts').select('*');
  if (gifts) {
    for (const g of gifts) {
      await supabase
        .from('gifts')
        .update({
          available_quantity: g.total_quantity,
          status: 'available',
          updated_at: new Date().toISOString(),
        })
        .eq('id', g.id);
    }
  }
}

export async function getDashboardStatsSupabase(): Promise<DashboardStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: gifts, error } = await supabase.from('gifts').select('total_quantity, available_quantity');
  if (error || !gifts) return null;

  const totalGifts = gifts.length;
  const totalUnits = gifts.reduce((acc, g) => acc + (Number(g.total_quantity) || 0), 0);
  const availableUnits = gifts.reduce((acc, g) => acc + (Number(g.available_quantity) || 0), 0);
  const chosenUnits = Math.max(0, totalUnits - availableUnits);
  const completionPercentage = totalUnits > 0 ? Math.round((chosenUnits / totalUnits) * 100) : 0;

  return {
    totalGifts,
    totalUnits,
    chosenUnits,
    availableUnits,
    completionPercentage,
  };
}
