const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return fail(res, 'Token manquant', 401);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return fail(res, 'Token invalide ou expiré', 401);
  }
};
