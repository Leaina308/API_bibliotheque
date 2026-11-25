const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { fail } = require('../utils/response');

const FREE_LIMIT = 2;

// Placé avant la route POST /borrows
module.exports = asyncHandler(async (req, res, next) => {
  const [[user]] = await db.query(
    'SELECT subscription_status FROM users WHERE id = ?', [req.user.id]);

  // Premium : aucune limite
  if (user?.subscription_status === 'premium') {
    req.paymentStatus = 'paid';
    return next();
  }
  req.paymentStatus = 'free';

  // Si user_name est absent ou invalide, la validation existante répondra 422
  const name = req.body && req.body.user_name;
  if (typeof name !== 'string' || !name.trim()) return next();

  const [[{ n }]] = await db.query(
    'SELECT COUNT(*) AS n FROM borrows WHERE user_name = ? AND returned_at IS NULL',
    [name.trim()]);

  if (n >= FREE_LIMIT)
    return fail(res, `Limite atteinte : ${FREE_LIMIT} emprunts actifs maximum en abonnement gratuit. Passez premium pour emprunter sans limite.`, 403);

  next();
});