import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createAssetRouter } from './src/server/assetRoutes';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Restrição de CORS baseada na origem do aplicativo
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigin = process.env.APP_ORIGIN || origin || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, x-user-id');
    res.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Length');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Rotas de API de Assets
  app.use('/api/v1', createAssetRouter());
  // Alias sem prefixo v1 para compatibilidade estrita com a spec
  app.use('/', createAssetRouter());

  if (!isProduction) {
    // Modo Desenvolvimento: Monta o Vite via middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Modo Produção: Serve arquivos estáticos da pasta dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[3D Social Lounge] Servidor ativo em http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[3D Social Lounge] Falha ao iniciar servidor:', err);
  process.exit(1);
});
