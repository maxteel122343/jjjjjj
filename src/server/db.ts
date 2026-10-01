import { Pool } from 'pg';

function createMockPool() {
  const queryHandler = async (text: string, _params?: any[]) => {
    const cleanText = text.trim().toUpperCase();
    if (cleanText === 'BEGIN' || cleanText === 'COMMIT' || cleanText === 'ROLLBACK') {
      return { rows: [] };
    }
    if (cleanText.includes('INSERT INTO PUBLIC.ASSETS')) {
      return { rows: [{ id: 'mock-asset-' + Math.random().toString(36).substring(2, 10) }] };
    }
    if (cleanText.includes('INSERT INTO PUBLIC.ASSET_UPLOAD_SESSIONS')) {
      return { rows: [{ id: 'mock-session-' + Math.random().toString(36).substring(2, 10) }] };
    }
    return { rows: [] };
  };

  return {
    query: queryHandler,
    connect: async () => ({
      query: queryHandler,
      release: () => {},
    }),
  } as unknown as Pool;
}

let pool: Pool | null = null;

export function getDatabasePool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('[AI Studio] DATABASE_URL não configurada — mock do banco de dados ativo');
      pool = createMockPool();
      return pool;
    }

    try {
      const isSsl = connectionString.includes('sslmode=require') || connectionString.includes('supabase.co');
      pool = new Pool({
        connectionString,
        ssl: isSsl ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000,
        max: 5,
      });
    } catch {
      console.warn('[AI Studio] Falha ao inicializar pool do PostgreSQL — mock ativo');
      pool = createMockPool();
    }
  }

  return pool;
}

export const db = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getDatabasePool() as any)[prop];
  },
});

