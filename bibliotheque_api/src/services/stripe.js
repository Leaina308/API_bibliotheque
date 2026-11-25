const crypto = require('crypto');
class StripeError extends Error {}

const PLAN = { amount: 500, currency: 'eur', name: 'premium' };

async function createPaymentIntent(userId) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError('STRIPE_SECRET_KEY non configurée dans .env');

  const form = new URLSearchParams({
    amount: String(PLAN.amount),
    currency: PLAN.currency,
    'automatic_payment_methods[enabled]': 'true',
    'metadata[user_id]': String(userId),
    'metadata[plan]': PLAN.name,
  });

  let res;
  try {
    res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    console.error('Erreur Stripe :', e);
    throw new StripeError('Stripe injoignable');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.client_secret) {
    console.error('Réponse Stripe :', res.status, json);
    throw new StripeError(`Stripe a refusé la requête (HTTP ${res.status})`);
  }
  return json;
}

// Vérifie l'en-tête Stripe-Signature : "t=<timestamp>,v1=<HMAC-SHA256 de 't.corps'>"
function verifySignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret || !Buffer.isBuffer(rawBody)) return false;

  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length) return false;

  // Refuse les messages trop vieux (5 min) : protège contre le rejeu
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;

  const expected = crypto.createHmac('sha256', secret)
    .update(`${t}.${rawBody.toString('utf8')}`).digest('hex');
  const exp = Buffer.from(expected);

  return sigs.some((s) => {
    const b = Buffer.from(s);
    return b.length === exp.length && crypto.timingSafeEqual(b, exp);
  });
}

module.exports = { StripeError, PLAN, createPaymentIntent, verifySignature };