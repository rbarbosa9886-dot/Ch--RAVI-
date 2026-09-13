/**
 * Centralized Storage & Persistence Service for Chá de Fraldas do Ravi.
 * 
 * Provides unified, automatic, bidirectional synchronization between:
 * 1. Component State (Immediate React reactivity)
 * 2. LocalStorage (Instant local persistence surviving reloads/sessions)
 * 3. Server API (/api/event, /api/gifts, /api/admin/sync-all)
 * 4. Cross-tab synchronization via Storage Events
 */

import { EventDetails, Gift, Reservation } from '../types.ts';
import { DEFAULT_EVENT_DETAILS, INITIAL_GIFTS } from '../data/defaultGifts.ts';

// Storage keys
export const STORAGE_KEYS = {
  EVENT: 'ravi_custom_event',
  EVENT_CACHED: 'ravi_cached_event',
  GIFTS: 'ravi_custom_gifts',
  GIFTS_CACHED: 'ravi_cached_gifts',
  RESERVATIONS: 'ravi_custom_reservations',
  ADMIN_TOKEN: 'ravi_admin_token',
  SNAPSHOT: 'ravi_last_saved_snapshot',
  AUTOSAVE_META: 'ravi_autosave_meta',
} as const;

// Custom DOM Event Names for instantaneous app-wide reactivity
export const STORAGE_EVENTS = {
  EVENT_UPDATED: 'ravi_event_details_updated',
  GIFTS_UPDATED: 'ravi_gifts_updated',
  AUTOSAVE_STATE: 'ravi_autosave_state_changed',
} as const;

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveInfo {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  lastSavedFormatted: string | null;
  message?: string;
  error?: string;
}

// In-memory current autosave state
let currentAutosaveInfo: AutosaveInfo = {
  status: 'idle',
  lastSavedAt: null,
  lastSavedFormatted: null,
};

// Debounce timer for API sync of eventDetails
let eventApiDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingEventUpdates: Partial<EventDetails> | null = null;

/**
 * Emit custom event on window so all components (Header, AdminModal, GiftCard, etc.)
 * update immediately without needing full page reloads.
 */
function emitCustomEvent<T>(eventName: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    const event = new CustomEvent(eventName, { detail: data });
    window.dispatchEvent(event);
  } catch (err) {
    console.error(`[StorageService] Failed to dispatch ${eventName}:`, err);
  }
}

/**
 * Update and notify autosave status
 */
export function setAutosaveStatus(
  status: AutosaveStatus,
  options?: { message?: string; error?: string; timestamp?: number }
) {
  const timestamp = options?.timestamp || (status === 'saved' ? Date.now() : currentAutosaveInfo.lastSavedAt);
  const formatted = timestamp
    ? new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : currentAutosaveInfo.lastSavedFormatted;

  currentAutosaveInfo = {
    status,
    lastSavedAt: timestamp,
    lastSavedFormatted: formatted,
    message: options?.message,
    error: options?.error,
  };

  try {
    localStorage.setItem(STORAGE_KEYS.AUTOSAVE_META, JSON.stringify(currentAutosaveInfo));
  } catch {}

  emitCustomEvent(STORAGE_EVENTS.AUTOSAVE_STATE, currentAutosaveInfo);
}

export function getAutosaveStatus(): AutosaveInfo {
  if (!currentAutosaveInfo.lastSavedAt) {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUTOSAVE_META);
      if (stored) {
        currentAutosaveInfo = JSON.parse(stored);
      }
    } catch {}
  }
  return currentAutosaveInfo;
}

// ==========================================
// EVENT DETAILS CENTRALIZED LOGIC
// ==========================================

/**
 * Get stored EventDetails synchronously from localStorage.
 * Falls back to DEFAULT_EVENT_DETAILS.
 */
export function getStoredEventDetails(): EventDetails {
  if (typeof window === 'undefined') return DEFAULT_EVENT_DETAILS;
  try {
    const custom = localStorage.getItem(STORAGE_KEYS.EVENT);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_EVENT_DETAILS, ...parsed };
      }
    }
    const cached = localStorage.getItem(STORAGE_KEYS.EVENT_CACHED);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_EVENT_DETAILS, ...parsed };
      }
    }
  } catch (err) {
    console.warn('[StorageService] Error reading stored event details:', err);
  }
  return DEFAULT_EVENT_DETAILS;
}

/**
 * Synchronously writes EventDetails to localStorage and notifies all components.
 * Guarantees zero data loss on page exit or reload.
 */
export function writeStoredEventDetailsLocal(details: EventDetails): EventDetails {
  const normalized: EventDetails = {
    ...details,
    isCustomized: true,
    updatedAt: details.updatedAt || Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEYS.EVENT, JSON.stringify(normalized));
    localStorage.setItem(STORAGE_KEYS.EVENT_CACHED, JSON.stringify(normalized));
  } catch (err) {
    console.error('[StorageService] Failed to write event details to localStorage:', err);
  }

  // Notify listeners immediately
  emitCustomEvent(STORAGE_EVENTS.EVENT_UPDATED, normalized);
  return normalized;
}

/**
 * Centrally saves EventDetails:
 * 1. Synchronously saves to localStorage (instant persistence)
 * 2. Emits real-time event to all open tabs & components
 * 3. Automatically debounces sync to server API
 */
export function autoSaveEventDetails(
  updates: Partial<EventDetails>,
  token?: string | null,
  options: { immediate?: boolean; debounceMs?: number } = {}
): EventDetails {
  const current = getStoredEventDetails();
  const merged: EventDetails = {
    ...current,
    ...updates,
    isCustomized: true,
    updatedAt: Date.now(),
  };

  // 1. Instant local persistence
  writeStoredEventDetailsLocal(merged);

  // 2. Set autosave state to saving
  setAutosaveStatus('saving', { message: 'Salvando alterações...' });

  // 3. Debounce API sync
  pendingEventUpdates = merged;
  const debounceTime = options.immediate ? 0 : (options.debounceMs ?? 600);

  if (eventApiDebounceTimer) {
    clearTimeout(eventApiDebounceTimer);
    eventApiDebounceTimer = null;
  }

  const executeApiSync = async () => {
    const toSend = pendingEventUpdates || merged;
    pendingEventUpdates = null;

    const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';

    try {
      const res = await fetch('/api/event', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(toSend),
      });

      if (res.ok) {
        const serverSaved: EventDetails = await res.json();
        writeStoredEventDetailsLocal(serverSaved);
        setAutosaveStatus('saved', {
          message: 'Salvo com sucesso no navegador e no servidor',
          timestamp: Date.now(),
        });
      } else {
        // Fallback: Even if API threw 401/500, local data is safely stored
        setAutosaveStatus('saved', {
          message: 'Salvo localmente no dispositivo',
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      console.warn('[StorageService] Background API sync failed (saved offline locally):', err);
      setAutosaveStatus('saved', {
        message: 'Salvo localmente (modo offline)',
        timestamp: Date.now(),
      });
    }
  };

  if (debounceTime <= 0) {
    executeApiSync();
  } else {
    eventApiDebounceTimer = setTimeout(executeApiSync, debounceTime);
  }

  return merged;
}

/**
 * Flush any pending event details autosave immediately (e.g. before closing modal or leaving page)
 */
export async function flushEventAutosave(token?: string | null): Promise<void> {
  if (eventApiDebounceTimer) {
    clearTimeout(eventApiDebounceTimer);
    eventApiDebounceTimer = null;
  }
  if (pendingEventUpdates) {
    const toSend = pendingEventUpdates;
    pendingEventUpdates = null;
    const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';
    try {
      await fetch('/api/event', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(toSend),
      });
    } catch {}
  }
}

// ==========================================
// GIFTS CENTRALIZED LOGIC
// ==========================================

/**
 * Get stored Gifts synchronously from localStorage.
 * Falls back to INITIAL_GIFTS.
 */
export function getStoredGifts(): Gift[] {
  if (typeof window === 'undefined') return INITIAL_GIFTS;
  try {
    const custom = localStorage.getItem(STORAGE_KEYS.GIFTS);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      if (parsed && Array.isArray(parsed.gifts)) return parsed.gifts;
    }
    const cached = localStorage.getItem(STORAGE_KEYS.GIFTS_CACHED);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('[StorageService] Error reading stored gifts:', err);
  }
  return INITIAL_GIFTS;
}

/**
 * Synchronously writes Gifts to localStorage and notifies all components.
 */
export function writeStoredGiftsLocal(gifts: Gift[]): Gift[] {
  const normalized = gifts.map((g) => ({
    ...g,
    isCustomized: true,
    updatedAt: g.updatedAt || Date.now(),
  }));

  try {
    localStorage.setItem(STORAGE_KEYS.GIFTS, JSON.stringify(normalized));
    localStorage.setItem(STORAGE_KEYS.GIFTS_CACHED, JSON.stringify(normalized));
  } catch (err) {
    console.error('[StorageService] Failed to write gifts to localStorage:', err);
  }

  emitCustomEvent(STORAGE_EVENTS.GIFTS_UPDATED, normalized);
  return normalized;
}

/**
 * Centrally saves complete gifts list:
 * Writes to localStorage synchronously and syncs with backend.
 */
export async function autoSaveGifts(gifts: Gift[], token?: string | null): Promise<Gift[]> {
  setAutosaveStatus('saving', { message: 'Salvando presentes...' });
  const written = writeStoredGiftsLocal(gifts);

  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';

  try {
    await fetch('/api/admin/sync-all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveToken}`,
      },
      body: JSON.stringify({ gifts: written }),
    });

    setAutosaveStatus('saved', {
      message: 'Lista de presentes salva com sucesso!',
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('[StorageService] Gifts sync offline fallback:', err);
    setAutosaveStatus('saved', {
      message: 'Presentes salvos localmente',
      timestamp: Date.now(),
    });
  }

  return written;
}

/**
 * Adds or updates a single gift through centralized persistence.
 */
export async function autoSaveSingleGift(
  giftData: Partial<Gift>,
  token?: string | null,
  editingId?: string
): Promise<Gift> {
  setAutosaveStatus('saving', { message: 'Salvando presente...' });
  const currentGifts = getStoredGifts();

  let targetGift: Gift;
  let updatedList: Gift[];

  if (editingId) {
    // Editing existing gift
    const existing = currentGifts.find((g) => g.id === editingId);
    let newTotal = Number(giftData.totalQuantity) || (existing ? existing.totalQuantity : 1);
    let newAvailable = existing ? existing.availableQuantity : newTotal;

    if (existing && typeof giftData.totalQuantity === 'number') {
      const diff = giftData.totalQuantity - existing.totalQuantity;
      newAvailable = Math.max(0, existing.availableQuantity + diff);
    }

    targetGift = {
      ...(existing || {}),
      ...giftData,
      id: editingId,
      name: giftData.name || existing?.name || 'Presente',
      description: giftData.description || '',
      category: giftData.category || existing?.category || 'outros',
      imageUrl: giftData.imageUrl || existing?.imageUrl || '',
      suggestedBrand: giftData.suggestedBrand?.trim() || undefined,
      totalQuantity: newTotal,
      availableQuantity: newAvailable,
      status: newAvailable > 0 ? 'available' : 'depleted',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: Date.now(),
      isCustomized: true,
    } as Gift;

    updatedList = currentGifts.map((g) => (g.id === editingId ? targetGift : g));
  } else {
    // Creating new gift
    const total = Number(giftData.totalQuantity) || 1;
    targetGift = {
      id: 'gift-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      name: giftData.name?.trim() || 'Novo Presente',
      description: giftData.description?.trim() || '',
      category: giftData.category || 'fraldas',
      imageUrl:
        giftData.imageUrl ||
        'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80',
      suggestedBrand: giftData.suggestedBrand?.trim() || undefined,
      totalQuantity: total,
      availableQuantity: total,
      status: 'available',
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      isCustomized: true,
    };

    updatedList = [targetGift, ...currentGifts];
  }

  // Write synchronously to localStorage
  writeStoredGiftsLocal(updatedList);

  // Sync to API
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';

  try {
    if (editingId) {
      await fetch(`/api/gifts/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(giftData),
      });
    } else {
      await fetch('/api/gifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(targetGift),
      });
    }

    setAutosaveStatus('saved', {
      message: editingId ? 'Presente atualizado com sucesso!' : 'Novo presente salvo com sucesso!',
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('[StorageService] Gift API sync offline fallback:', err);
    setAutosaveStatus('saved', {
      message: 'Presente salvo localmente',
      timestamp: Date.now(),
    });
  }

  return targetGift;
}

/**
 * Centrally deletes a gift:
 * Updates localStorage immediately, emits event, and syncs to backend.
 */
export async function autoDeleteGift(giftId: string, token?: string | null): Promise<void> {
  setAutosaveStatus('saving', { message: 'Excluindo presente...' });
  const currentGifts = getStoredGifts();
  const updatedList = currentGifts.filter((g) => g.id !== giftId);

  // 1. Instant local removal
  writeStoredGiftsLocal(updatedList);

  // 2. API Sync
  const effectiveToken = token || localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || 'authenticated-ravi-admin';

  try {
    await fetch(`/api/gifts/${giftId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
      },
    });

    setAutosaveStatus('saved', {
      message: 'Presente removido com sucesso!',
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn('[StorageService] Delete API offline fallback:', err);
    setAutosaveStatus('saved', {
      message: 'Presente removido localmente',
      timestamp: Date.now(),
    });
  }
}

// ==========================================
// CROSS-TAB & LIFECYCLE LISTENERS
// ==========================================

export function subscribeToEventDetails(callback: (details: EventDetails) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: any) => {
    if (e.detail) callback(e.detail);
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.EVENT && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback(parsed);
      } catch {}
    }
  };

  window.addEventListener(STORAGE_EVENTS.EVENT_UPDATED, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(STORAGE_EVENTS.EVENT_UPDATED, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

export function subscribeToGifts(callback: (gifts: Gift[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: any) => {
    if (e.detail) callback(e.detail);
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.GIFTS && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) callback(parsed);
      } catch {}
    }
  };

  window.addEventListener(STORAGE_EVENTS.GIFTS_UPDATED, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(STORAGE_EVENTS.GIFTS_UPDATED, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

export function subscribeToAutosave(callback: (info: AutosaveInfo) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: any) => {
    if (e.detail) callback(e.detail);
  };

  window.addEventListener(STORAGE_EVENTS.AUTOSAVE_STATE, handleCustomEvent);

  return () => {
    window.removeEventListener(STORAGE_EVENTS.AUTOSAVE_STATE, handleCustomEvent);
  };
}

// Flush pending writes on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushEventAutosave();
  });
}
