'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');

const { env } = require('./config/env');
const { initQueue, closeQueue } = require('./lib/queue');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const registryRoutes = require('./routes/registry.routes');
const giftRoutes = require('./routes/gift.routes');
const extraRoutes = require('./routes/extra.routes');

async function initApp() {
  await initQueue();
  return buildApp();
}

function buildApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (env.CORS_ORIGINS_LIST.includes(origin) || env.CORS_ORIGINS_LIST.includes('*')) {
          return cb(null, true);
        }
        return cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
      maxAge: 86400,
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime_s: Math.round(process.uptime()) });
  });

  // Временный лог для отладки
console.log('--- Swagger Debug ---');
console.log('__dirname:', __dirname);
console.log('Target path:', path.resolve(__dirname, '..', 'docs', 'openapi.yaml'));
console.log('Exists:', fs.existsSync(path.resolve(__dirname, '..', 'docs', 'openapi.yaml')));
console.log('---------------------');

  const openapiPath = path.resolve(__dirname, '..', 'docs', 'openapi.yaml');

  if (fs.existsSync(openapiPath)) {
    try {
      const spec = yaml.load(fs.readFileSync(openapiPath, 'utf8'));
      // Настраиваем префикс /docs
      app.use('/docs', swaggerUi.serve);
      app.get('/docs', swaggerUi.setup(spec, { explorer: true }));
      
      // На всякий случай пропишем и /api/docs, если ты к нему привык
      app.use('/api/docs', swaggerUi.serve);
      app.get('/api/docs', swaggerUi.setup(spec, { explorer: true }));

      console.log('✅ Swagger UI ready on /docs and /api/docs');
    } catch (e) {
      console.error('❌ Failed to load YAML:', e.message);
    }
  } else {
    console.error('⚠️ openapi.yaml not found at:', openapiPath);
  }

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/registries', registryRoutes);
  app.use('/api/v1/gifts', giftRoutes);
  app.use('/api/v1', extraRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { buildApp, initApp, closeQueue };