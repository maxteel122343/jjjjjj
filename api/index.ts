import express from 'express';
import dotenv from 'dotenv';
import { createAssetRouter } from '../src/server/assetRoutes';

dotenv.config();

const app = express();

app.use(express.json({ limit: '50mb' }));

// Configuração de CORS para Vercel
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

const assetRouter = createAssetRouter();

// Mapeia todas as variações de prefixo para garantir resolução em qualquer ambiente Vercel
app.use('/api/v1', assetRouter);
app.use('/v1', assetRouter);
app.use('/api', assetRouter);
app.use('/', assetRouter);

export default app;
