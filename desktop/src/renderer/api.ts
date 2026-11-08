import type { DesktopApi } from './types';
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';
export function localApi(): DesktopApi {
  if (!window.inventoryDesktop) throw new Error('Local storage requires the desktop app, not a browser preview');
  return window.inventoryDesktop;
}
