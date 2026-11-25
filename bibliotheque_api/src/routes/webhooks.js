const router = require('express').Router();
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { fail } = require('../utils/response');
const { verifySignature } = require('../services/stripe');

// POST /webhooks/stripe : pas de JWT, l'authenticité vient de la signature
router.post('/stripe', asyncHandler(async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return fail(res, 'STRIPE_WEBHOOK_SECRET non configurée', 503);

  // req.body est ici le corps BRUT (Buffer), voir app.js
  if (!verifySignature(req.body, req.headers['stripe-signature'], secret))
    return fail(res, 'Signature Stripe invalide ou absente', 401);

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return fail(res, 'JSON invalide', 400);
  }

  if (event.type === 'payment_intent.succeeded') {
    const meta = event.data?.object?.metadata || {};
    const userId = Number(meta.user_id);
    if (meta.plan === 'premium' && Number.isInteger(userId)) {
      const [r] = await db.query(
        "UPDATE users SET subscription_status = 'premium' WHERE id = ?", [userId]);
      if (!r.affectedRows) console.warn(`Webhook Stripe : utilisateur ${userId} introuvable`);
    }
  }

  res.json({ received: true });
}));

module.exports = router;