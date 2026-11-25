require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { fail } = require('./utils/response');

const app = express();
app.use(cors());
app.use(express.json());

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(YAML.load('./openapi.yaml')));

app.get('/', (req, res) => {
  res.json({ message: 'Bonjour, mon API Bibliothèque fonctionne !' });
});

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/authors', require('./routes/authors'));
app.use('/api/v1/books', require('./routes/books'));
app.use('/api/v1/borrows', require('./routes/borrows'));

// Route inconnue -> 404
app.use((req, res) => fail(res, 'Route introuvable', 404));

// Erreurs imprévues
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return fail(res, 'JSON invalide', 400);
  if (err.code === 'ER_DUP_ENTRY') return fail(res, 'Validation échouée', 422, { isbn: ['Cet ISBN existe déjà.'] });
  console.error(err);
  fail(res, 'Erreur serveur', 500);
});

module.exports = app;
