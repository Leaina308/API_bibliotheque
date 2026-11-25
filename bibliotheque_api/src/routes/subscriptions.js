const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/response');
const stripe = require('../services/stripe');

router.use(auth); // toutes ces routes demandent un token

// POST /subscriptions/payment-intent
router.post('/payment-intent', asyncHandler(async (req, res) => {
  const [[user]] = await db.query('SELECT id FROM users WHERE id = ?', [req.user.id]);
  if (!user) return fail(res, 'Utilisateur introuvable', 404);

  let pi;
  try {
    pi = await stripe.createPaymentIntent(user.id);
  } catch (e) {
    if (e instanceof stripe.StripeError) return fail(res, e.message, 503);
    throw e;
  }

  ok(res, {
    client_secret: pi.client_secret,
    amount: stripe.PLAN.amount,
    currency: stripe.PLAN.currency,
    publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || null,
  });
}));

// GET /subscriptions/status
router.get('/status', asyncHandler(async (req, res) => {
  const [[user]] = await db.query(
    'SELECT id, subscription_status FROM users WHERE id = ?', [req.user.id]);
  if (!user) return fail(res, 'Utilisateur introuvable', 404);

  ok(res, {
    user_id: user.id,
    subscription_status: user.subscription_status,
    borrow_limit: user.subscription_status === 'premium' ? null : 2, // null = illimité
  }, "Statut d'abonnement");
}));

module.exports = router;