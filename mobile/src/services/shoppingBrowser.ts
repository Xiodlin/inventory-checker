import { randomUUID } from 'expo-crypto';
import { AppState } from 'react-native';
import { matchShoppingCards, shoppingCardsSchema, shoppingInput, type ShoppingInput, type ShoppingSearch } from '@inventory-checker/core';

export interface BrowserSearch { id: string; input: ShoppingInput }
let pending: { request: BrowserSearch; resolve: (result: ShoppingSearch) => void; timer: ReturnType<typeof setTimeout> } | undefined;
const listeners = new Set<() => void>();
const changed = () => { for (const listener of listeners) listener(); };
export const shoppingBrowser = {
  current: () => pending?.request,
  busy: () => Boolean(pending),
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  search(value: ShoppingInput): Promise<ShoppingSearch> {
    const input = shoppingInput.parse(value);
    if (pending) throw new Error('A shopping search is already running.');
    if (!listeners.size || AppState.currentState !== 'active') throw new Error('Google searches require the mobile app to be open and active.');
    return new Promise(resolve => {
      const request = { id: randomUUID(), input };
      const timer = setTimeout(() => shoppingBrowser.finish(request.id, undefined,
        'Google search timed out after 30 seconds. No availability was inferred.'), 30000);
      pending = { request, resolve, timer }; changed();
    });
  },
  finish(id: string, cards?: unknown, error: string | null = null) {
    if (!pending || pending.request.id !== id) return;
    let offers: ShoppingSearch['offers'] = [];
    if (!error) {
      try {
        offers = matchShoppingCards(shoppingCardsSchema.parse(cards), pending.request.input);
        if (!offers.length) error = 'No readable shopping offers were found. No availability was inferred.';
      } catch (failure) { error = failure instanceof Error ? failure.message : 'Unreadable shopping results'; }
    }
    if (error) console.warn('Mobile shopping search failed:', error);
    const { request, resolve, timer } = pending;
    clearTimeout(timer); pending = undefined;
    resolve({ id: request.id, input: request.input, checked_at: new Date().toISOString(), offers, error });
    changed();
  },
  cancel() { if (pending) shoppingBrowser.finish(pending.request.id, undefined, 'Shopping search was cancelled when the app left the foreground.'); },
};
