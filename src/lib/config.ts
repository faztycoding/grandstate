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
