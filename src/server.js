const app = require('./app');
const db = require('./config/db');

const port = process.env.PORT || 8000;

db.query('SELECT 1')
  .then(() => app.listen(port, () => console.log(`Serveur sur http://localhost:${port}`)))
  .catch((err) => {
    console.error('Connexion MariaDB impossible :', err.message);
    process.exit(1);
  });
