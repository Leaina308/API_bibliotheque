export TOKEN=$(curl -s -X POST localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@biblio.com","password":"password123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')
echo "TOKEN chargé (${#TOKEN} caractères)"
