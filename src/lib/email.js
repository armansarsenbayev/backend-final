'use strict';

/**
 * Email service using Resend API.
 * All sending is fire-and-forget from the caller's perspective —
 * actual delivery happens asynchronously via the BullMQ queue.
 */

const { env } = require('../config/env');

let resendClient = null;

function getResend() {
  if (!resendClient) {
    try {
      const { Resend } = require('resend');
      resendClient = new Resend(env.RESEND_API_KEY || 'test');
    } catch {
      return null;
    }
  }
  return resendClient;
}

async function sendEmail({ to, subject, html }) {
  const resend = getResend();
  if (!resend || !env.RESEND_API_KEY) {
    console.log(`[email] MOCK send to ${to}: ${subject}`);
    return { id: 'mock-' + Date.now() };
  }
  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`[email] Sent to ${to}: ${subject} (id=${result.id})`);
    return result;
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err.message);
    throw err;
  }
}

// ── Email templates ─────────────────────────────────────────────────────────

async function sendVerificationEmail({ to, username, token }) {
  const link = `${env.APP_URL}/api/v1/auth/verify-email?token=${token}`;
  return sendEmail({
    to,
    subject: 'Verify your Saukele account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="color:#1F4E79;margin-bottom:8px">Welcome to Saukele 🎉</h1>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Please verify your email address to activate your account.</p>
        <a href="${link}" style="display:inline-block;background:#1F4E79;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Verify Email
        </a>
        <p style="color:#666;font-size:12px">Link expires in 24 hours. If you didn't sign up, ignore this email.</p>
        <p style="color:#999;font-size:11px">${link}</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail({ to, username, token }) {
  const link = `${env.APP_URL}/api/v1/auth/reset-password?token=${token}`;
  return sendEmail({
    to,
    subject: 'Reset your Saukele password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="color:#1F4E79">Password Reset</h1>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Click the button below to reset your password. The link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#1F4E79;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>
        <p style="color:#999;font-size:11px">${link}</p>
      </div>
    `,
  });
}

async function sendGiftFundedEmail({ to, hostUsername, giftTitle, registryTitle }) {
  return sendEmail({
    to,
    subject: `🎁 "${giftTitle}" has been fully funded!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="color:#1D6B2E">Gift Fully Funded! 🎉</h1>
        <p>Hi <strong>${hostUsername}</strong>,</p>
        <p>Great news! The gift <strong>"${giftTitle}"</strong> in your registry 
           <strong>"${registryTitle}"</strong> has reached its funding goal.</p>
        <p>A vendor can now proceed with the purchase.</p>
        <p style="color:#666;font-size:12px">— The Saukele Team</p>
      </div>
    `,
  });
}

async function sendGiftPurchasedEmail({ to, hostUsername, giftTitle, courierId }) {
  return sendEmail({
    to,
    subject: `📦 "${giftTitle}" has been purchased!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="color:#1F4E79">Gift Purchased!</h1>
        <p>Hi <strong>${hostUsername}</strong>,</p>
        <p>The gift <strong>"${giftTitle}"</strong> has been purchased by a vendor
           and assigned to a courier for delivery.</p>
        <p style="color:#666;font-size:12px">— The Saukele Team</p>
      </div>
    `,
  });
}

async function sendGiftDeliveredEmail({ to, hostUsername, giftTitle }) {
  return sendEmail({
    to,
    subject: `✅ "${giftTitle}" has been delivered!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="color:#1D6B2E">Gift Delivered! 🎊</h1>
        <p>Hi <strong>${hostUsername}</strong>,</p>
        <p>The gift <strong>"${giftTitle}"</strong> has been successfully delivered. Congratulations!</p>
        <p style="color:#666;font-size:12px">— The Saukele Team</p>
      </div>
    `,
  });
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendGiftFundedEmail,
  sendGiftPurchasedEmail,
  sendGiftDeliveredEmail,
};