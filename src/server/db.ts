import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDatabasePool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL_MISSING: A variável DATABASE_URL é obrigatória para persistência relacional.');
    }

    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : false,
    });
  }

  return pool;
}
