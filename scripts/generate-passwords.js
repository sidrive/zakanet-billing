#!/usr/bin/env node
"use strict"

/**
 * Bulk-generates a `password_hash` for every customer that doesn't have one yet, so the
 * "Cek Tagihan" public lookup works without hand-editing each customer in Firestore Console.
 *
 * Safe to re-run: only touches customers where `password_hash` is missing/empty, so it never
 * overwrites a password an admin already set by hand (e.g. via scripts/hash-password.js).
 *
 * Requires a Firebase service account key with Firestore write access to the `zakanet-billing`
 * project (Firebase Console → Project Settings → Service Accounts → Generate new private key).
 * NEVER commit that key file.
 *
 * Usage:
 *   cd scripts && npm install                       # once
 *   node generate-passwords.js --service-account=/path/to/serviceAccountKey.json
 *
 *   # Preview only — no writes, no CSV, just a count:
 *   node generate-passwords.js --service-account=/path/to/serviceAccountKey.json --dry-run
 *
 * Output:
 *   Writes customers/{id}.password_hash (bcrypt) in batches, and saves a CSV of the PLAINTEXT
 *   passwords to scripts/output/passwords-<timestamp>.csv — the only place the plaintext ever
 *   exists, because bcrypt can't be reversed to recover it later. That file is git-ignored.
 *
 *   ⚠️ Distribute those passwords to customers (e.g. one-by-one via WhatsApp) and then DELETE
 *   the CSV. Don't leave it sitting on disk, don't paste it into chat/email in bulk, don't
 *   commit it — it's a flat list of every customer's login credential.
 */

const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const bcrypt = require("bcryptjs")
const { initializeApp, cert, applicationDefault } = require("firebase-admin/app")
const { getFirestore } = require("firebase-admin/firestore")

const BCRYPT_COST = 10
const PASSWORD_LENGTH = 8
// Excludes visually ambiguous characters (0/O, 1/l/I) so customers can retype it correctly.
const PASSWORD_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
const FIRESTORE_BATCH_SIZE = 400 // Firestore's hard limit is 500 writes/batch; leave headroom.

function parseArgs(argv) {
  const args = { dryRun: false, serviceAccount: null }
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true
    else if (arg.startsWith("--service-account=")) args.serviceAccount = arg.split("=")[1]
  }
  return args
}

function generatePassword() {
  let out = ""
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out += PASSWORD_CHARSET[crypto.randomInt(0, PASSWORD_CHARSET.length)]
  }
  return out
}

function toCsvField(value) {
  const str = String(value ?? "")
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/**
 * Core logic, separated from CLI/Firestore-connection setup so it can be exercised in tests
 * against a fake `db` without needing real GCP credentials.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ dryRun?: boolean, outDir?: string }} [options]
 * @returns {Promise<{ total: number, alreadyHad: number, generated: number, outPath: string | null }>}
 */
async function run(db, { dryRun = false, outDir = path.join(__dirname, "output") } = {}) {
  const snapshot = await db.collection("customers").get()
  const eligible = snapshot.docs.filter((doc) => !doc.data().password_hash)

  console.log(`Total pelanggan: ${snapshot.size}`)
  console.log(`Sudah punya password_hash: ${snapshot.size - eligible.length}`)
  console.log(`Akan digenerate: ${eligible.length}`)

  if (eligible.length === 0) {
    console.log("Tidak ada yang perlu digenerate. Selesai.")
    return { total: snapshot.size, alreadyHad: snapshot.size, generated: 0, outPath: null }
  }

  if (dryRun) {
    console.log("\n(--dry-run) Tidak ada perubahan ditulis. Jalankan tanpa --dry-run untuk eksekusi.")
    return {
      total: snapshot.size,
      alreadyHad: snapshot.size - eligible.length,
      generated: 0,
      outPath: null,
    }
  }

  const rows = [] // { id, name, phone, password }

  for (let i = 0; i < eligible.length; i += FIRESTORE_BATCH_SIZE) {
    const chunk = eligible.slice(i, i + FIRESTORE_BATCH_SIZE)
    const batch = db.batch()

    for (const doc of chunk) {
      const password = generatePassword()
      const passwordHash = bcrypt.hashSync(password, BCRYPT_COST)
      const data = doc.data()

      batch.update(doc.ref, { password_hash: passwordHash })
      rows.push({ id: doc.id, name: data.name ?? "", phone: data.phone ?? "", password })
    }

    await batch.commit()
    console.log(`Ditulis ${Math.min(i + chunk.length, eligible.length)}/${eligible.length}...`)
  }

  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `passwords-${Date.now()}.csv`)

  const csv = [
    "id,name,phone,password",
    ...rows.map((r) => [r.id, r.name, r.phone, r.password].map(toCsvField).join(",")),
  ].join("\n")

  fs.writeFileSync(outPath, csv, "utf8")

  console.log(`\n✅ Selesai. ${rows.length} password_hash ditulis ke Firestore.`)
  console.log(`📄 Password asli (plaintext) tersimpan di: ${outPath}`)
  console.log(
    "⚠️  Segera distribusikan ke masing-masing pelanggan (mis. satu per satu lewat WhatsApp),",
  )
  console.log("    lalu HAPUS file CSV ini. Jangan commit, jangan bagikan sekaligus.")

  return {
    total: snapshot.size,
    alreadyHad: snapshot.size - eligible.length,
    generated: rows.length,
    outPath,
  }
}

async function main() {
  const { dryRun, serviceAccount } = parseArgs(process.argv.slice(2))

  initializeApp({
    credential: serviceAccount ? cert(require(path.resolve(serviceAccount))) : applicationDefault(),
  })
  const db = getFirestore()

  await run(db, { dryRun })
}

module.exports = { run, generatePassword, toCsvField, PASSWORD_CHARSET, PASSWORD_LENGTH }

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
