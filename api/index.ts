import express, { Request, Response, NextFunction } from 'express';
import { createAssetRouter, checkServerConfig, sanitizeErrorMessage } from '../src/server/assetRoutes';

let cachedApp: express.Application | null = null;

function getExpressApp(): express.Application {
  if (!cachedApp) {
    const app = express();
    app.use(express.json());

    app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers?.origin;
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

    const router = createAssetRouter();
    app.use('/api/v1', router);
    app.use('/v1', router);
    app.use('/api', router);
    app.use('/', router);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[API Express Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: err?.code || 'INTERNAL_SERVER_ERROR',
          message: sanitizeErrorMessage(err?.message || 'Erro interno do servidor'),
        });
      }
    });

    cachedApp = app;
  }
  return cachedApp;
}

/**
 * Handler Serverless invocado pela plataforma Vercel no runtime Node.js.
 * Todas as validações de process.env ocorrem dentro do handler no momento da requisição.
 */
export default async function handler(req: any, res: any) {
  // CORS Preflight
  const origin = req.headers?.origin;
  const allowedOrigin = process.env.APP_ORIGIN || origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, x-user-id');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Length');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 1. Validação de process.env LIDA DENTRO DO HANDLER no momento da invocação
  const configError = checkServerConfig();
  if (configError) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify(configError));
    return;
  }

  // 2. Execução protegida por try/catch garantindo resposta JSON
  try {
    const app = getExpressApp();
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Handler Exception]:', err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: err?.code || 'HANDLER_EXECUTION_ERROR',
          message: sanitizeErrorMessage(err),
        })
      );
    }
  }
}
