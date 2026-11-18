import { Capacitor } from '@capacitor/core';

export const DEFAULT_BACKEND_URL =
  'https://ais-pre-w6m5aocjevp6x3vgl6yxg6-977857223551.europe-west2.run.app';
const BACKEND_OVERRIDE_KEY = 'vip_service_backend_url';

let initialized = false;

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getActiveBackendUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_BACKEND_URL;
  const saved = localStorage.getItem(BACKEND_OVERRIDE_KEY)?.trim();
  if (saved) return saved.replace(/\/+$/, '');
  const envUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (envUrl && isNativePlatform()) return envUrl.replace(/\/+$/, '');
  if (isNativePlatform()) return DEFAULT_BACKEND_URL;
  return window.location.origin;
}

export function setCustomBackendUrl(url: string): { ok: boolean; error?: string } {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) {
    localStorage.removeItem(BACKEND_OVERRIDE_KEY);
    return { ok: true };
  }
  try {
    const parsed = new URL(trimmed);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !isLocal) {
      return { ok: false, error: 'Backend URL must use HTTPS for secure Android communication.' };
    }
    localStorage.setItem(BACKEND_OVERRIDE_KEY, parsed.origin);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Enter a valid URL (e.g. https://your-backend.run.app).' };
  }
}

export function initApiBridge(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const targetUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const shouldRewrite =
      targetUrl.startsWith('/api/') &&
      (isNativePlatform() || Boolean(localStorage.getItem(BACKEND_OVERRIDE_KEY)));

    if (!shouldRewrite) {
      return originalFetch(input, init);
    }

    const base = getActiveBackendUrl();
    const resolvedUrl = `${base}${targetUrl}`;

    if (typeof input === 'string' || input instanceof URL) {
      return originalFetch(resolvedUrl, init);
    }

    const clonedReq = new Request(resolvedUrl, input);
    return originalFetch(clonedReq, init);
  };
}
