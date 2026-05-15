'use strict';

/**
 * BullMQ email queue backed by Redis (Upstash in production, local in dev).
 * Falls back to direct synchronous sending if Redis is unavailable —
 * this keeps the API working even without Redis configured.
 */

const { env } = require('../config/env');
const emailService = require('./email');

let Queue, Worker, emailQueue, emailWorker;

function getRedisConnection() {
  if (env.REDIS_URL) {
    const u = new URL(env.REDIS_URL);
    return {
      host: u.hostname,
      port: Number(u.port) || 6379,
      username: u.username || 'default',
      password: decodeURIComponent(u.password || ''),
      tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    };
  }
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      host: new URL(env.UPSTASH_REDIS_REST_URL).hostname,
      port: 6379,
      username: 'default',
      password: env.UPSTASH_REDIS_REST_TOKEN,
      tls: {},
    };
  }
  return null;
}

async function probeRedis(conn) {
  const IORedis = require('ioredis');
  const client = new IORedis({
    ...conn,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    connectTimeout: 5000,
  });
  try {
    await client.connect();
    await client.ping();
  } finally {
    client.disconnect();
  }
}

async function initQueue() {
  const conn = getRedisConnection();
  if (!conn) {
    console.log('[queue] No Redis configured — email will be sent synchronously');
    return;
  }

  try {
    await probeRedis(conn);
  } catch (err) {
    console.warn('[queue] Redis unavailable — email will be sent synchronously:', err.message);
    return;
  }

  try {
    ({ Queue, Worker } = require('bullmq'));

    emailQueue = new Queue('emails', {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    emailWorker = new Worker('emails', async (job) => {
      const { type, payload } = job.data;
      console.log(`[queue] Processing email job: ${type}`);
      switch (type) {
        case 'verification':
          await emailService.sendVerificationEmail(payload);
          break;
        case 'password_reset':
          await emailService.sendPasswordResetEmail(payload);
          break;
        case 'gift_funded':
          await emailService.sendGiftFundedEmail(payload);
          break;
        case 'gift_purchased':
          await emailService.sendGiftPurchasedEmail(payload);
          break;
        case 'gift_delivered':
          await emailService.sendGiftDeliveredEmail(payload);
          break;
        default:
          console.warn(`[queue] Unknown email type: ${type}`);
      }
    }, { connection: conn, concurrency: 3 });

    emailWorker.on('completed', (job) => console.log(`[queue] Email job ${job.id} completed`));
    emailWorker.on('failed', (job, err) => console.error(`[queue] Email job ${job.id} failed:`, err.message));
    emailQueue.on('error', (err) => console.error('[queue] Queue error:', err.message));
    emailWorker.on('error', (err) => console.error('[queue] Worker error:', err.message));

    console.log('[queue] BullMQ email queue initialized with Redis');
  } catch (err) {
    console.warn('[queue] Failed to init BullMQ:', err.message, '— falling back to sync');
    emailQueue = null;
  }
}

async function enqueueEmail(type, payload) {
  if (emailQueue) {
    await emailQueue.add(type, { type, payload }, { priority: 1 });
    console.log(`[queue] Enqueued email job: ${type}`);
  } else {
    // Fallback: send synchronously (non-blocking via promise)
    setImmediate(async () => {
      try {
        switch (type) {
          case 'verification':    await emailService.sendVerificationEmail(payload); break;
          case 'password_reset':  await emailService.sendPasswordResetEmail(payload); break;
          case 'gift_funded':     await emailService.sendGiftFundedEmail(payload); break;
          case 'gift_purchased':  await emailService.sendGiftPurchasedEmail(payload); break;
          case 'gift_delivered':  await emailService.sendGiftDeliveredEmail(payload); break;
        }
      } catch (err) {
        console.error(`[queue] Fallback email failed (${type}):`, err.message);
      }
    });
  }
}

async function getQueueStatus() {
  if (!emailQueue) return { status: 'no_redis', mode: 'synchronous_fallback' };
  const [waiting, active, completed, failed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
  ]);
  return { status: 'redis_connected', waiting, active, completed, failed };
}

async function closeQueue() {
  if (emailWorker) await emailWorker.close();
  if (emailQueue) await emailQueue.close();
}

module.exports = { initQueue, enqueueEmail, getQueueStatus, closeQueue };