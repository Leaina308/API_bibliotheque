const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/response');
const llm = require('../services/llm');

const BOOK_SQL = `SELECT b.id, b.title, b.year, b.summary, b.summary_model, b.summary_generated_at,
  a.first_name, a.last_name FROM books b JOIN authors a ON a.id = b.author_id`;

const findBook = async (id) => (await db.query(`${BOOK_SQL} WHERE b.id = ?`, [id]))[0][0];

const payload = (b) => ({
  book_id: b.id,
  title: b.title,
  summary: b.summary,
  generated_by: b.summary_model,
  generated_at: b.summary_generated_at ? b.summary_generated_at.replace(' ', 'T') + 'Z' : null,
});

// POST /books/:id/summary : génère et sauvegarde (protégée)
router.post('/:id/summary', auth, asyncHandler(async (req, res) => {
  const book = await findBook(req.params.id);
  if (!book) return fail(res, 'Livre introuvable', 404);

  // Résumé déjà là : on ne rappelle pas l'IA
  if (book.summary)
    return ok(res, payload(book), 'Résumé existant retourné (pas de nouvel appel API)');

  let out;
  try {
    out = await llm.generateSummary(book);
  } catch (e) {
    if (e instanceof llm.ServiceError) return fail(res, e.message, 503);
    throw e;
  }

  await db.query(
    'UPDATE books SET summary = ?, summary_model = ?, summary_generated_at = UTC_TIMESTAMP() WHERE id = ?',
    [out.text, out.model, book.id]);
  ok(res, payload(await findBook(book.id)), 'Résumé généré');
}));

// GET /books/:id/summary : lit le résumé existant (publique)
router.get('/:id/summary', asyncHandler(async (req, res) => {
  const book = await findBook(req.params.id);
  if (!book) return fail(res, 'Livre introuvable', 404);
  if (!book.summary) return fail(res, 'Aucun résumé pour ce livre', 404);
  ok(res, payload(book), 'Résumé du livre');
}));

// POST /books/smart-search : l'IA extrait des mots-clés, puis on cherche en base (publique)
router.post('/smart-search', asyncHandler(async (req, res) => {
  const query = req.body && req.body.query;
  if (typeof query !== 'string' || query.trim().length < 3)
    return fail(res, 'Validation échouée', 422, { query: ['La description est requise (3 caractères minimum).'] });

  let keywords;
  try {
    keywords = await llm.extractKeywords(query.trim());
  } catch (e) {
    if (e instanceof llm.ServiceError) return fail(res, e.message, 503);
    throw e;
  }

  // Un mot-clé peut apparaître dans le titre, le résumé ou le nom de l'auteur
  const like = (k) => `%${k.replace(/[\\%_]/g, '\\$&')}%`;
  const where = keywords
    .map(() => '(b.title LIKE ? OR b.summary LIKE ? OR a.first_name LIKE ? OR a.last_name LIKE ?)')
    .join(' OR ');
  const params = keywords.flatMap((k) => Array(4).fill(like(k)));

  const [rows] = await db.query(
    `SELECT b.id, b.title, b.isbn, b.year, b.available, b.summary,
            a.id AS a_id, a.first_name, a.last_name
     FROM books b JOIN authors a ON a.id = b.author_id
     WHERE ${where}`, params);

  const data = rows.map((r) => ({
    id: r.id, title: r.title, isbn: r.isbn, year: r.year, available: !!r.available,
    summary: r.summary,
    author: { id: r.a_id, first_name: r.first_name, last_name: r.last_name },
  }));

  res.json({ success: true, query: query.trim(), keywords, data });
}));

module.exports = router;