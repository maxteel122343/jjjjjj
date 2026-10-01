import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDatabasePool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString || !connectionString.trim()) {
      throw new Error('DATABASE_CONFIG_MISSING: Variável ausente: DATABASE_URL');
    }

    const isSsl = connectionString.includes('sslmode=require') || connectionString.includes('supabase.co');
    pool = new Pool({
      connectionString: connectionString.trim(),
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000,
      max: 10,
    });
  }

  return pool;
}

export const db = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getDatabasePool() as any)[prop];
  },
});
