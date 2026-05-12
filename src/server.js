'use strict';

const { env } = require('./config/env');
const { buildApp } = require('./app');
const { prisma, disconnect } = require('./lib/prisma');

async function main() {
  // Validate DB connectivity at boot.
  await prisma.$connect();

  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[saukele] listening on http://localhost:${env.PORT}  (env=${env.NODE_ENV})`,
    );
    // eslint-disable-next-line no-console
    console.log(`[saukele] swagger UI: http://localhost:${env.PORT}/docs`);
  });

  // Graceful shutdown.
  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[saukele] received ${signal}, shutting down...`);
    server.close(async (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('[saukele] server.close error:', err);
        process.exit(1);
      }
      try {
        await disconnect();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[saukele] prisma disconnect error:', e);
      }
      process.exit(0);
    });
    // Force-exit after 10s if connections won't drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[saukele] fatal startup error:', err);
  process.exit(1);
});