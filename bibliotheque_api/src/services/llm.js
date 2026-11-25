class ServiceError extends Error {}

// Appel commun à l'API compatible OpenAI
async function call(body) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ServiceError('OPENAI_API_KEY non configurée dans .env');
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  let res;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, ...body }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    console.error('Erreur appel IA :', e);
    throw new ServiceError('Service IA injoignable');
  }
  if (!res.ok) {
    console.error('Réponse IA :', res.status, await res.text());
    throw new ServiceError(`Service IA indisponible (HTTP ${res.status})`);
  }
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new ServiceError('Réponse vide du service IA');
  return { text, model };
}

async function generateSummary(book) {
  return call({
    temperature: 0.7,
    messages: [
      { role: 'system', content: 'Tu es un expert en littérature. Tu génères des résumés concis et accrocheurs pour des fiches de bibliothèque. Réponds toujours en français. Maximum 3 phrases.' },
      { role: 'user', content: `Génère un résumé pour le livre intitulé "${book.title}" écrit par ${book.first_name} ${book.last_name}, publié en ${book.year}.` },
    ],
  });
}

const STOP = ['un', 'une', 'des', 'les', 'le', 'la', 'de', 'du', 'sur', 'en', 'et', 'pour', 'qui', 'que', 'dans', 'avec', 'livre'];

async function extractKeywords(query) {
  const { text } = await call({
    temperature: 0,
    messages: [
      { role: 'system', content: 'Tu extrais les mots-clés de recherche d\'une demande de livre. Réponds UNIQUEMENT avec un tableau JSON de 2 à 6 chaînes courtes, sans texte autour. Exemple : ["programmation","Java","bonnes pratiques"]' },
      { role: 'user', content: query },
    ],
  });

  try {
    const m = text.replace(/```(?:json)?/g, '').match(/\[[\s\S]*\]/);
    const kw = JSON.parse(m[0]).filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim());
    if (kw.length) return kw.slice(0, 8);
  } catch { /* on retombe sur un découpage simple */ }

  // Plan B si l'IA n'a pas répondu en JSON : on garde les mots utiles de la phrase
  return query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.includes(w)).slice(0, 6);
}

module.exports = { ServiceError, generateSummary, extractKeywords };