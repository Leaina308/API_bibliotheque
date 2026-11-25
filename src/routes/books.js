const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/response');

// Requête de base : un livre + son auteur (JOIN)
const SELECT = `SELECT b.id, b.title, b.isbn, b.year, b.available,
  a.id AS a_id, a.first_name, a.last_name
  FROM books b JOIN authors a ON a.id = b.author_id`;

// Transforme une ligne SQL en objet JSON propre
const format = (r) => ({
  id: r.id,
  title: r.title,
  isbn: r.isbn,
  year: r.year,
  available: !!r.available,          // 1/0 devient true/false
  author: { id: r.a_id, first_name: r.first_name, last_name: r.last_name },
});

// Cherche un livre par id (undefined s'il n'existe pas)
const findBook = async (id) => {
  const [[row]] = await db.query(`${SELECT} WHERE b.id = ?`, [id]);
  return row && format(row);
};

// Validation : retourne un objet d'erreurs (vide si tout va bien)
// currentId sert à ignorer le livre lui-même lors d'une modification
async function validate(b, currentId = 0) {
  const e = {};

  if (typeof b.title !== 'string' || !b.title.trim())
    e.title = ['Le titre est requis.'];

  if (typeof b.isbn !== 'string' || !b.isbn.trim())
    e.isbn = ["L'ISBN est requis."];
  else if (!/^[0-9Xx-]{10,17}$/.test(b.isbn.trim()))
    e.isbn = ["Format d'ISBN invalide (ex: 978-0132350884)."];
  else {
    const [dup] = await db.query('SELECT id FROM books WHERE isbn = ? AND id <> ?',
      [b.isbn.trim(), currentId]);
    if (dup.length) e.isbn = ['Cet ISBN existe déjà.'];
  }

  if (!Number.isInteger(b.year) || b.year < 1000 || b.year > new Date().getFullYear() + 1)
    e.year = ["L'année doit être un entier valide."];

  if (!Number.isInteger(b.author_id))
    e.author_id = ["L'auteur est requis (nombre entier)."];
  else {
    const [a] = await db.query('SELECT id FROM authors WHERE id = ?', [b.author_id]);
    if (!a.length) e.author_id = ["L'auteur n'existe pas."];
  }

  return e;
}

// GET /books : liste, avec filtre ?available=true|false (publique)
router.get('/', asyncHandler(async (req, res) => {
  const { available } = req.query;

  if (available !== undefined) {
    if (!['true', 'false'].includes(available))
      return fail(res, 'Validation échouée', 422, { available: ['Doit valoir true ou false.'] });
    const [rows] = await db.query(`${SELECT} WHERE b.available = ? ORDER BY b.id`,
      [available === 'true' ? 1 : 0]);
    const msg = available === 'true' ? 'Liste des livres disponibles' : 'Liste des livres empruntés';
    return ok(res, rows.map(format), msg);
  }

  const [rows] = await db.query(`${SELECT} ORDER BY b.id`);
  ok(res, rows.map(format), 'Liste des livres');
}));

// POST /books : ajouter (protégée)
router.post('/', auth, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const errors = await validate(b);
  if (Object.keys(errors).length) return fail(res, 'Validation échouée', 422, errors);

  const [r] = await db.query(
    'INSERT INTO books (title, isbn, year, author_id) VALUES (?, ?, ?, ?)',
    [b.title.trim(), b.isbn.trim(), b.year, b.author_id]);
  ok(res, await findBook(r.insertId), 'Livre créé', 201);
}));

// GET /books/:id : détails + auteur (publique)
router.get('/:id', asyncHandler(async (req, res) => {
  const book = await findBook(req.params.id);
  if (!book) return fail(res, 'Livre introuvable', 404);
  ok(res, book, 'Détails du livre');
}));

// PUT /books/:id : modifier (protégée)
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const book = await findBook(req.params.id);
  if (!book) return fail(res, 'Livre introuvable', 404);

  const b = req.body || {};
  const errors = await validate(b, book.id);
  if (Object.keys(errors).length) return fail(res, 'Validation échouée', 422, errors);

  await db.query(
    'UPDATE books SET title = ?, isbn = ?, year = ?, author_id = ? WHERE id = ?',
    [b.title.trim(), b.isbn.trim(), b.year, b.author_id, book.id]);
  ok(res, await findBook(book.id), 'Livre modifié');
}));

// DELETE /books/:id : supprimer (protégée)
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const [r] = await db.query('DELETE FROM books WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) return fail(res, 'Livre introuvable', 404);
  res.status(204).send();
}));

module.exports = router;
