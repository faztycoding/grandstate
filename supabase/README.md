# Supabase Database Setup

## Quick Setup (New Project)

Run **`FULL_SETUP.sql`** in Supabase SQL Editor — it creates all core tables, indexes, RLS policies, and triggers. Safe to re-run (uses `IF NOT EXISTS` / `CREATE OR REPLACE`).

Then run these additional migrations in order:

```
1. FULL_SETUP.sql          ← Core tables + RLS + triggers
2. add_display_id.sql      ← User display IDs (GS###XX format)
3. support_tickets.sql     ← Support ticket system
4. security_fixes.sql      ← Additional security hardening
```

## File Reference

| File | Description | When to run |
|------|-------------|-------------|
| `FULL_SETUP.sql` | **Main setup** — users, properties, facebook_groups, license_keys, device_activations, RLS policies, indexes, admin function | First setup |
| `add_display_id.sql` | Adds `display_id` column (GS###XX) to users + auto-generate trigger | After FULL_SETUP |
| `support_tickets.sql` | Support tickets table + RLS policies | After FULL_SETUP |
| `security_fixes.sql` | Additional RLS hardening + policy fixes | After FULL_SETUP |
| `verify-and-fix-rls.sql` | Diagnostic script — checks RLS status on all tables | Troubleshooting only |
| `schema.sql` | Legacy reference schema (subset of FULL_SETUP) | Not needed |
| `license_keys.sql` | Legacy license keys schema (subset of FULL_SETUP) | Not needed |

## Migrations

`migrations/` contains incremental changes:
- `20240215_add_proxy_url.sql` — Adds `proxy_url` column to users table
