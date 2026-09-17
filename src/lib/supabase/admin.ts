import { createMySQLClient } from "@/lib/db/mysql";

/**
 * Global database client.
 * Migrated to MySQL backend while preserving full Supabase-compatible query interface.
 */
export function createAdminSupabaseClient() {
  return createMySQLClient();
}

export { createMySQLClient };
