import { supabase } from './supabase';

// Central configuration — all env vars in one place
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export const ADMIN_EMAILS: string[] = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export const ADMIN_SECRET: string = import.meta.env.VITE_ADMIN_SECRET || '';

/**
 * Authenticated fetch — auto-attaches Supabase JWT token
 * Use this instead of raw fetch() for all backend API calls
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}
