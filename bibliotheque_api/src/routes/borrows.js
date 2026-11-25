const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const borrowLimit = require('../middleware/borrowLimit');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/response');

const COLS = 'id, user_name, book_id, borrowed_at, returned_at, payment_status';

// Toutes les routes d'emprunts sont protégées : le vigile passe une seule fois ici
router.use(auth);

// GET /borrows : emprunts en cours (non rendus)
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT ${COLS} FROM borrows WHERE returned_at IS NULL ORDER BY id`);
  ok(res, rows, 'Liste des emprunts en cours');
}));

// POST /borrows : enregistrer un emprunt
router.post('/', borrowLimit, asyncHandler(async (req, res) => {
  const { user_name, book_id } = req.body || {};

  // 1. Validation
  const errors = {};
  if (typeof user_name !== 'string' || !user_name.trim())
    errors.user_name = ["Le nom de l'emprunteur est requis."];
  if (!Number.isInteger(book_id))
    errors.book_id = ['Le livre est requis (nombre entier).'];
  if (Object.keys(errors).length) return fail(res, 'Validation échouée', 422, errors);

  // 2. Transaction : tout réussit, ou rien n'est fait
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE verrouille la ligne : deux personnes ne peuvent pas emprunter le même livre en même temps
    const [[book]] = await conn.query(
      'SELECT id, available FROM books WHERE id = ? FOR UPDATE', [book_id]);

    if (!book) {
      await conn.rollback();
      return fail(res, 'Livre introuvable', 404);
    }
    if (!book.available) {
      await conn.rollback();
      return fail(res, 'Validation échouée', 422, { book_id: ["Ce livre n'est pas disponible."] });
    }

    const [r] = await conn.query(
      'INSERT INTO borrows (user_name, book_id, borrowed_at, returned_at, payment_status) VALUES (?, ?, NOW(), NULL, ?)',
      [user_name.trim(), book_id, req.paymentStatus || 'free']);
    await conn.query('UPDATE books SET available = 0 WHERE id = ?', [book_id]);

    await conn.commit();   // on valide les deux opérations

    const [[borrow]] = await db.query(`SELECT ${COLS} FROM borrows WHERE id = ?`, [r.insertId]);
    ok(res, borrow, 'Emprunt enregistré', 201);
  } catch (err) {
    await conn.rollback(); // en cas d'erreur, on annule tout
    throw err;
  } finally {
    conn.release();        // on rend la connexion au pool
  }
}));

// PATCH /borrows/:id/return : marquer un livre comme rendu
router.patch('/:id/return', asyncHandler(async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[borrow]] = await conn.query(
      'SELECT id, book_id, returned_at FROM borrows WHERE id = ? FOR UPDATE', [req.params.id]);

    if (!borrow) {
      await conn.rollback();
      return fail(res, 'Emprunt introuvable', 404);
    }
    if (borrow.returned_at) {
      await conn.rollback();
      return fail(res, 'Validation échouée', 422, { id: ['Ce livre a déjà été rendu.'] });
    }

    await conn.query('UPDATE borrows SET returned_at = NOW() WHERE id = ?', [borrow.id]);
    await conn.query('UPDATE books SET available = 1 WHERE id = ?', [borrow.book_id]);

    await conn.commit();

    const [[updated]] = await db.query(`SELECT ${COLS} FROM borrows WHERE id = ?`, [borrow.id]);
    ok(res, updated, 'Livre rendu');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

module.exports = router;
