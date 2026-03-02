// Deterministic GS-format display ID from Supabase UUID
// Produces consistent IDs like "GS5998Q" from any UUID
export function uuidToDisplayId(uuid: string): string {
  if (!uuid) return '';
  const hex = uuid.replace(/-/g, '');
  const num = parseInt(hex.slice(0, 4), 16) % 10000;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const c1 = chars[parseInt(hex.slice(4, 6), 16) % 26];
  return `GS${String(num).padStart(4, '0')}${c1}`;
}
