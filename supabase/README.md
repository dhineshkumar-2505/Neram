# Supabase Infrastructure & Database Directory

This directory manages database migrations, Edge Functions, seed scripts, and configuration for the Neram platform.

## Directory Structure
- `migrations/`: Version-controlled SQL migration scripts executed sequentially.
- `functions/`: Deno Edge Functions for server-side operations (e.g. `create-group`, `lifecycle-worker`, `send-notification`).
- `seed/`: Development test fixtures and baseline seed data.

## Local Development Workflow
To run Supabase locally with Docker:
```bash
# Start local Supabase container stack
npx supabase start

# Apply pending migrations
npx supabase migration up

# Generate updated TypeScript types for the React Native client
npx supabase gen types typescript --local > ../src/types/database.ts

# Stop local stack
npx supabase stop
```
