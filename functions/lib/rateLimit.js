"use strict"

/**
 * Very small fixed-window rate limiter backed by Firestore.
 *
 * Not a replacement for Firebase App Check / Cloud Armor — this is the minimum bar so a public,
 * unauthenticated endpoint isn't trivially brute-forceable. Keyed by caller IP (falls back to a
 * shared bucket if the IP can't be read, which is intentionally conservative — better to rate
 * limit too aggressively than not at all on a public endpoint).
 */

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} key - caller IP (or another stable identifier)
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
async function checkAndConsume(db, key) {
  const ref = db.collection("public_login_attempts").doc(sanitizeKey(key))
  const now = Date.now()

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.exists ? snap.data() : null

    const windowExpired = !data || now - data.windowStartedAt > WINDOW_MS

    if (windowExpired) {
      tx.set(ref, { count: 1, windowStartedAt: now })
      return { allowed: true, remaining: MAX_ATTEMPTS - 1 }
    }

    if (data.count >= MAX_ATTEMPTS) {
      return { allowed: false, remaining: 0 }
    }

    tx.update(ref, { count: data.count + 1 })
    return { allowed: true, remaining: MAX_ATTEMPTS - data.count - 1 }
  })
}

/** Clears the counter for a key — call after a successful lookup so legitimate users aren't
 * penalized by earlier typos. */
async function reset(db, key) {
  await db.collection("public_login_attempts").doc(sanitizeKey(key)).delete()
}

function sanitizeKey(key) {
  // Firestore doc IDs can't contain "/"; IPv6 addresses do.
  return String(key || "unknown").replace(/\//g, "_")
}

module.exports = { checkAndConsume, reset, WINDOW_MS, MAX_ATTEMPTS }
