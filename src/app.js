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

  // Trust the first proxy hop (so req.ip is correct behind a reverse proxy).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Security headers.
  app.use(helmet());

  // CORS allowlist.
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // curl / mobile / server-to-server
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

  // Health probe.
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime_s: Math.round(process.uptime()) });
  });

  // Swagger UI mounted at /docs reading docs/openapi.yaml.
  const openapiPath = path.resolve(__dirname, '..', 'docs', 'openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    const spec = yaml.load(fs.readFileSync(openapiPath, 'utf8'));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { explorer: true }));
    app.get('/openapi.yaml', (_req, res) => res.type('text/yaml').send(fs.readFileSync(openapiPath, 'utf8')));
  }

  // API routes.
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/registries', registryRoutes);
  app.use('/api/v1/gifts', giftRoutes);
  app.use('/api/v1', extraRoutes);

  // 404 + error handler (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { buildApp, initApp, closeQueue };