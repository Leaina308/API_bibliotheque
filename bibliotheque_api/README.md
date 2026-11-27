# API Bibliothèque

API REST de gestion d'une bibliothèque (auteurs, livres, emprunts), développée avec **Express.js** et **SQLite**, authentification par **JWT**, documentée avec **Swagger (OpenAPI 3)** et testée avec **Postman**.

## Prérequis

- Node.js 18 ou plus récent (testé avec Node 22)
- npm
- Git (facultatif)
- Postman (pour les tests) et Newman (facultatif, pour les tests en ligne de commande)

Installation de Node.js sous Ubuntu :

```bash
sudo apt update && sudo apt install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

## Installation

```bash
git clone <url-du-depot> bibliotheque_api
cd bibliotheque_api
npm install
cp .env.example .env
npm run seed
```

Le fichier `.env` contient la configuration :

```
PORT=8000
JWT_SECRET=bibliotheque123
JWT_EXPIRES_IN=24h
```

## Lancement

```bash
npm start        # lancement normal
npm run dev      # lancement avec rechargement automatique (nodemon)
```

L'API est disponible sur `http://localhost:8000`.

| Commande | Rôle |
|---|---|
| `npm start` | Démarre le serveur |
| `npm run dev` | Démarre avec nodemon |
| `npm run seed` | Remplit la base (utilisateur de test, 3 auteurs, 5 livres, 2 emprunts) |

## Compte de test

| Email | Mot de passe |
|---|---|
| `admin@biblio.com` | `password123` |

## Documentation Swagger

Une fois le serveur lancé : **http://localhost:8000/api/docs**

Pour tester une route protégée : faites `POST /auth/login`, copiez le `token`, cliquez sur **Authorize**, collez-le, puis testez la route.

Le fichier de spécification se trouve à la racine : `openapi.yaml`.

## Endpoints

URL de base : `http://localhost:8000/api/v1`

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | Non | Connexion, retourne un token JWT |
| GET | `/authors` | Non | Liste des auteurs |
| GET | `/authors/{id}` | Non | Détails d'un auteur avec ses livres |
| POST | `/authors` | Oui | Créer un auteur |
| PUT | `/authors/{id}` | Oui | Modifier un auteur |
| DELETE | `/authors/{id}` | Oui | Supprimer un auteur |
| GET | `/books` | Non | Liste des livres (filtre `?
available=true\|false`) |
| GET | `/books/{id}` | Non | Détails d'un livre |
| POST | `/books` | Oui | Créer un livre |
| PUT | `/books/{id}` | Oui | Modifier un livre |
| DELETE | `/books/{id}` | Oui | Supprimer un livre |
| GET | `/borrows` | Oui | Emprunts en cours |
| POST | `/borrows` | Oui | Emprunter un livre |
| PATCH | `/borrows/{id}/return` | Oui | Rendre un livre |

#  Nouvelle endpoints dans devoir 6 : 
| POST | `/books/{id}/summary` | Oui | génère et sauvegarde |
| GET | `/books/{id}/summary` | Non | lit le résumé existant |
| POST | `/books/smart-search` | Non | Recherche par description naturelle |
| POST | `/subscriptions/payment-intent` | Oui | Crée un PaymentIntent Stripe |
| GET | `/subscriptions/status` | Oui | Statut d'abonnement de l'utilisateur |
| POST | `/webhooks/stripe` | Non | Reçoit les événements Stripe |

Les routes protégées demandent l'en-tête `Authorization: Bearer <token>`.

## Format des réponses

Succès :

```json
{ "success": true, "data": { }, "message": "OK" }
```

Erreur :

```json
{ "success": false, "message": "Validation échouée", "errors": { "title": ["Le titre est requis."] } }
```

Codes HTTP utilisés : `200`, `201`, `204`, `400`, `401`, `404`, `422`, `500`.

## Exemple rapide

```bash
TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@biblio.com","password":"password123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s localhost:8000/api/v1/books
curl -s -X POST localhost:8000/api/v1/borrows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_name":"Jean Rakoto","book_id":2}'
```

## Tests avec Postman

1. Importez la collection `API-Bibliotheque-Aina.postman_collection.json` et les environnements `Devellopement.postman_environment.json` et `Production.postman_environment.json` (menu **Import**).
2. Sélectionnez l'environnement **Développement**.
3. Lancez le serveur (`npm run dev`) et remplissez la base (`npm run seed`).
4. Lancez la collection avec le **Runner** (ordre : Login, Create author, Create book, Get book, Create borrow, Return, Delete). Tous les tests doivent être verts.

En ligne de commande :

```bash
sudo npm i -g newman
newman run API-Bibliotheque-Aina.postman_collection.json -e Devellopement.postman_environment.json
```

## Structure du projet

```
bibliotheque_api/
├── src/
│   ├── server.js
│   ├── app.js
│   ├── db.js
│   ├── seed.js
│   ├── utils/response.js, asyncHandler.js
│   ├── middleware/auth.js, borrowlimit.js
│   └── routes/ (auth.js, authors.js, books.js, borrows.js, booiAi.js, subscription.js, webhooks.js)
├── openapi.yaml
├── .env.example
├── .gitignore
└── README.md
```

## Auteur

Projet réalisé dans le cadre du devoir de documentation d'API et API tierces. 
Nom : ANDRINIAINA Tahinjanahary
