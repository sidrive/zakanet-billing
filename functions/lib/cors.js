"use strict"

/**
 * Allow-list of origins permitted to call the public billing API.
 *
 * ⚠️ Update ALLOWED_ORIGINS with the real production domain(s) before/at deploy time — this
 * ships with placeholders + localhost dev ports only. Anything not in this list gets no
 * Access-Control-Allow-Origin header, so browsers block the response (server-to-server callers
 * bypass CORS entirely, so this is not itself an auth mechanism — see rateLimit.js + the
 * password check in index.js for the actual gate).
 */
const ALLOWED_ORIGINS = [
  "https://zakainternet.id", // TODO: confirm/replace with the real production domain
  "https://www.zakainternet.id",
  "http://localhost:5173", // Vite dev server
  "http://localhost:4173", // Vite preview
]

function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin)
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "Content-Type")
  res.set("Vary", "Origin")
}

module.exports = { applyCors, ALLOWED_ORIGINS }
