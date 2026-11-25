require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  // 1. Créer les tables
  await conn.query(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));

  // 2. Vider les tables (pour repartir de zéro)
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['borrows', 'books', 'authors', 'users']) await conn.query(`TRUNCATE TABLE ${t}`);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  // 3. Insérer les données de test
  await conn.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    ['Administrateur', 'admin@biblio.com', bcrypt.hashSync('password123', 10)]);

  await conn.query('INSERT INTO authors (first_name, last_name, nationality) VALUES ?', [[
    ['Robert', 'Martin', 'Américaine'],
    ['Martin', 'Fowler', 'Britannique'],
    ['Erich', 'Gamma', 'Suisse'],
  ]]);

  await conn.query('INSERT INTO books (title, isbn, year, available, author_id) VALUES ?', [[
    ['Clean Code', '978-0132350884', 2008, 0, 1],
    ['The Clean Coder', '978-0137081073', 2011, 1, 1],
    ['Refactoring', '978-0134757599', 2018, 0, 2],
    ['Patterns of Enterprise Application Architecture', '978-0321127426', 2002, 1, 2],
    ['Design Patterns', '978-0201633610', 1994, 1, 3],
  ]]);

  await conn.query(`INSERT INTO borrows (user_name, book_id, borrowed_at, returned_at) VALUES
    ('Alice Rakoto', 1, NOW() - INTERVAL 3 DAY, NULL),
    ('Bob Rabe', 3, NOW() - INTERVAL 1 DAY, NULL)`);

  console.log('Base initialisée : 1 utilisateur, 3 auteurs, 5 livres, 2 emprunts.');
  console.log('Compte de test : admin@biblio.com / password123');
  await conn.end();
})().catch((e) => { console.error('Erreur seed :', e.message); process.exit(1); });
