# Supabase Database Migrations

All schema changes, PostgreSQL enums, tables, indexes, triggers, and Row Level Security (RLS) policies are stored here as timestamped SQL files.

## Guidelines
1. Every migration must be idempotent and tested.
2. Every table must enable Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
3. Migrations will be applied starting in the database implementation phase according to `DATABASE_PLAN.md`.
