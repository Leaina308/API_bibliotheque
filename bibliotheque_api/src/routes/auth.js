const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/response');

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  const errors = {};
  if (!email) errors.email = ["L'email est requis."];
  if (!password) errors.password = ['Le mot de passe est requis.'];
  if (Object.keys(errors).length) return fail(res, 'Validation échouée', 422, errors);

  const [[user]] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(String(password), user.password))
    return fail(res, 'Identifiants invalides', 401);

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });

  ok(res, { token, user: { id: user.id, name: user.name, email: user.email } }, 'Connexion réussie');
}));

module.exports = router;
