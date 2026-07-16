// Thin wrapper around Google Gemini's free-tier API (https://aistudio.google.com/apikey).
// Kept isolated behind callGemini() so the provider can be swapped later without touching
// aiService.js's analysis logic.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function isAiEnabled() {
  return process.env.AI_ENABLED === 'true' && !!process.env.GEMINI_API_KEY;
}

async function callGemini(prompt) {
  if (!isAiEnabled()) {
    throw new Error('AI analysis is disabled. Set AI_ENABLED=true and GEMINI_API_KEY in .env');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n');
  if (!text) throw new Error('Gemini API returned no analysis text');
  return text;
}

module.exports = { callGemini, isAiEnabled };
