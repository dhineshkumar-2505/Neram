/**
 * Supabase Database TypeScript Definitions
 * 
 * This file will contain generated TypeScript types matching the PostgreSQL schema
 * defined in DATABASE_PLAN.md.
 * 
 * In later steps, these types are regenerated using the Supabase CLI:
 * `npx supabase gen types typescript --project-id <id> > src/types/database.ts`
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
