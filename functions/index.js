"use strict"

const { onRequest } = require("firebase-functions/v2/https")
const logger = require("firebase-functions/logger")
const { initializeApp } = require("firebase-admin/app")
const { getFirestore } = require("firebase-admin/firestore")

const { applyCors } = require("./lib/cors")
const { checkAndConsume, reset: resetRateLimit } = require("./lib/rateLimit")
const { lookupBilling } = require("./lib/billingLookup")

initializeApp()
const db = getFirestore()

const GENERIC_INVALID_MESSAGE = "Nama atau kata sandi salah. Silakan periksa kembali data Anda."
const RATE_LIMITED_MESSAGE = "Terlalu banyak percobaan. Silakan coba lagi dalam beberapa menit."

/**
 * Public HTTPS endpoint for the Zaka Internet landing page's "Cek Tagihan" page.
 *
 * POST { name: string, password: string }
 *   -> 200 { success: true, status: "lunas", lastPaidMonth, lastPaidDate }
 *   -> 200 { success: true, status: "belum-lunas", unpaidMonths: [{ month, due, paid, remaining }] }
 *   -> 200 { success: true, status: "tidak-ada-tagihan" }
 *   -> 401 { success: false, message }              // wrong name/password
 *   -> 429 { success: false, message }               // rate limited
 *   -> 400 { success: false, message }               // malformed request
 *
 * Uses the Admin SDK, so it is NOT subject to firestore.rules (those still block the browser's
 * own Firestore client — this function is the only sanctioned public read path). Never add
 * fields to the response beyond what's documented in docs/PUBLIC_BILLING_API.md — this endpoint
 * exists specifically so the public site never gets direct/broad access to `customers`.
 */
exports.checkBilling = onRequest({ region: "asia-southeast1", cors: false }, async (req, res) => {
  applyCors(req, res)

  if (req.method === "OPTIONS") {
    res.status(204).send("")
    return
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed." })
    return
  }

  const { name, password } = req.body || {}

  if (typeof name !== "string" || typeof password !== "string" || !name.trim() || !password) {
    res.status(400).json({ success: false, message: "Nama dan kata sandi wajib diisi." })
    return
  }

  const rateLimitKey = req.ip || req.headers["x-forwarded-for"] || "unknown"

  try {
    const { allowed } = await checkAndConsume(db, rateLimitKey)
    if (!allowed) {
      res.status(429).json({ success: false, message: RATE_LIMITED_MESSAGE })
      return
    }

    const result = await lookupBilling(db, name, password)

    if (!result.ok) {
      res.status(401).json({ success: false, message: GENERIC_INVALID_MESSAGE })
      return
    }

    await resetRateLimit(db, rateLimitKey)
    res.status(200).json({ success: true, ...result.data })
  } catch (err) {
    logger.error("checkBilling failed", err)
    res.status(500).json({ success: false, message: "Terjadi kesalahan. Silakan coba lagi." })
  }
})
