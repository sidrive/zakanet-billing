#!/usr/bin/env node
"use strict"

/**
 * Admin utility — generates a bcrypt hash to paste into a customer's `password_hash` field
 * in Firestore (customers/{id}). Run locally, never in the browser/client app.
 *
 * Usage:
 *   node scripts/hash-password.js "kata sandi pelanggan"
 *
 * Then in Firebase Console → Firestore → customers/{id}, add/update the field:
 *   password_hash: "<output>"   (string)
 *
 * See docs/PUBLIC_BILLING_API.md for why this field is needed and how it's used.
 */

// Run `npm install` inside scripts/ first (separate, tiny package.json — not deployed).
const bcrypt = require("bcryptjs")

const password = process.argv[2]

if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>")
  process.exit(1)
}

const hash = bcrypt.hashSync(password, 10)
console.log(hash)
