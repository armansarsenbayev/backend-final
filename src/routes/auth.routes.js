'use strict';

const express = require('express');
const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const authService = require('../services/auth.service');
const { registerSchema, loginSchema, refreshSchema, logoutSchema } = require('../schemas/auth.schema');

const router = express.Router();

const forgotSchema = z.object({ email: z.string().email() });
const resetSchema  = z.object({ token: z.string().min(10), password: z.string().min(10).refine(v => /[A-Za-z]/.test(v) && /\d/.test(v), 'must contain letter and digit') });
const resendSchema = z.object({ email: z.string().email() });

router.post('/register', authLimiter, validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const user = await authService.register(req.body);
    res.status(201).json({ ...user, message: 'Registration successful. Please check your email to verify your account.' });
  })
);

router.get('/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required', code: 'VALIDATION_ERROR', status_code: 400 });
    const result = await authService.verifyEmail({ token });
    res.status(200).json(result);
  })
);

router.post('/resend-verification', authLimiter, validate({ body: resendSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.resendVerification({ email: req.body.email });
    res.status(200).json(result);
  })
);

router.post('/login', authLimiter, validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.login({
      email: req.body.email, password: req.body.password,
      userAgent: req.get('user-agent'), ipAddress: req.ip,
    });
    res.status(200).json(result.tokens);
  })
);

router.post('/refresh', validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh({
      refreshTokenRaw: req.body.refresh_token,
      userAgent: req.get('user-agent'), ipAddress: req.ip,
    });
    res.status(200).json(result.tokens);
  })
);

router.post('/logout', requireAuth, validate({ body: logoutSchema }),
  asyncHandler(async (req, res) => {
    await authService.logout({ userId: req.user.id, refreshTokenRaw: req.body.refresh_token });
    res.status(204).send();
  })
);

router.get('/me', requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.user.id);
    res.status(200).json(user);
  })
);

router.post('/forgot-password', authLimiter, validate({ body: forgotSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword({ email: req.body.email });
    res.status(200).json(result);
  })
);

router.get('/reset-password',
  asyncHandler(async (req, res) => {
    const { token } = req.query;
    if (!token || !/^[0-9a-f]{64}$/.test(token)) {
      return res.status(400).send('<h2 style="font-family:sans-serif;color:#721c24">Invalid or missing reset token.</h2>');
    }
    // Allow inline scripts only for this page
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reset Password — Saukele</title>
  <style>
    body{font-family:sans-serif;max-width:420px;margin:60px auto;padding:24px}
    h1{color:#1F4E79}
    label{display:block;margin-top:16px;font-weight:600}
    input{width:100%;padding:10px;margin-top:6px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box}
    button{margin-top:20px;width:100%;padding:12px;background:#1F4E79;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:16px}
    #msg{margin-top:16px;padding:10px;border-radius:6px;display:none}
    .ok{background:#d4edda;color:#155724}.err{background:#f8d7da;color:#721c24}
  </style>
</head>
<body>
  <h1>Reset Password</h1>
  <p>Enter your new password below.</p>
  <form id="f">
    <label>New Password<input id="p" type="password" required minlength="10" placeholder="Min 10 chars, include a letter and digit"></label>
    <label>Confirm Password<input id="c" type="password" required minlength="10" placeholder="Repeat new password"></label>
    <button type="submit">Set New Password</button>
  </form>
  <div id="msg"></div>
  <script>
    document.getElementById('f').addEventListener('submit',async function(e){
      e.preventDefault();
      var p=document.getElementById('p').value,c=document.getElementById('c').value,m=document.getElementById('msg');
      m.style.display='none';
      if(p!==c){m.textContent='Passwords do not match.';m.className='err';m.style.display='block';return;}
      try{
        var r=await fetch('/api/v1/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'${token}',password:p})});
        var d=await r.json();
        if(r.ok){m.textContent=d.message||'Password reset successfully. You can now log in.';m.className='ok';m.style.display='block';document.getElementById('f').style.display='none';}
        else{m.textContent=(d.details&&d.details[0]&&d.details[0].issue)||d.error||'Something went wrong.';m.className='err';m.style.display='block';}
      }catch(err){m.textContent='Network error. Please try again.';m.className='err';m.style.display='block';}
    });
  </script>
</body>
</html>`);
  })
);

router.post('/reset-password', authLimiter, validate({ body: resetSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword({ token: req.body.token, newPassword: req.body.password });
    res.status(200).json(result);
  })
);

module.exports = router;