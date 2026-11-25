const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/response');

// Vérifie qu'une valeur est un texte non vide
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

// Validation des données d'un auteur : retourne un objet d'erreurs (vide si tout va bien)
function validate(b) {
  const e = {};
  if (!isStr(b.first_name)) e.first_name = ['Le prénom est requis.'];
  if (!isStr(b.last_name)) e.last_name = ['Le nom est requis.'];
  if (b.nationality != null && typeof b.nationality !== 'string')
    e.nationality = ['La nationalité doit être du texte.'];
  return e;
}

// Cherche un auteur par son id (retourne undefined s'il n'existe pas)
const findAuthor = async (id) => {
  const [[a]] = await db.query(
    'SELECT id, first_name, last_name, nationality FROM authors WHERE id = ?', [id]);
  return a;
};

// GET /authors : liste (publique)
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, first_name, last_name, nationality FROM authors ORDER BY id');
  ok(res, rows, 'Liste des auteurs');
}));

// POST /authors : créer (protégée)
router.post('/', auth, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const errors = validate(b);
  if (Object.keys(errors).length) return fail(res, 'Validation échouée', 422, errors);

  const [r] = await db.query(
    'INSERT INTO authors (first_name, last_name, nationality) VALUES (?, ?, ?)',
    [b.first_name.trim(), b.last_name.trim(), b.nationality ?? null]);
  ok(res, await findAuthor(r.insertId), 'Auteur créé', 201);
}));

// GET /authors/:id : détails + ses livres (publique)
router.get('/:id', asyncHandler(async (req, res) => {
  const author = await findAuthor(req.params.id);
  if (!author) return fail(res, 'Auteur introuvable', 404);

  const [books] = await db.query(
    'SELECT id, title, isbn, year, available FROM books WHERE author_id = ? ORDER BY id',
    [author.id]);
  author.books = books.map((b) => ({ ...b, available: !!b.available }));
  ok(res, author, "Détails de l'auteur");
}));

// PUT /authors/:id : modifier (protégée)
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const author = await findAuthor(req.params.id);
  if (!author) return fail(res, 'Auteur introuvable', 404);

  const b = req.body || {};
  const errors = validate(b);
  if (Object.keys(errors).length) return fail(res, 'Validation échouée', 422, errors);

  await db.query(
    'UPDATE authors SET first_name = ?, last_name = ?, nationality = ? WHERE id = ?',
    [b.first_name.trim(), b.last_name.trim(), b.nationality ?? null, author.id]);
  ok(res, await findAuthor(author.id), 'Auteur modifié');
}));

// DELETE /authors/:id : supprimer (protégée)
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const [r] = await db.query('DELETE FROM authors WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) return fail(res, 'Auteur introuvable', 404);
  res.status(204).send();
}));

module.exports = router;
