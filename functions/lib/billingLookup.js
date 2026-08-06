"use strict"

const bcrypt = require("bcryptjs")

/**
 * Verifies {name, password} against `customers` and returns the caller-facing billing status.
 *
 * IMPORTANT: this returns only the fields the public landing page needs (invoice month/amounts).
 * It never returns `balance`, `address`, `phone`, `password_hash`, or the Firestore doc id —
 * those stay server-side. See docs/PUBLIC_BILLING_API.md for the response contract and the
 * `customers.password_hash` field this expects (added separately, out of this change's scope).
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} name
 * @param {string} password
 * @returns {Promise<{ok: true, data: object} | {ok: false, reason: 'invalid' | 'no_password_set'}>}
 */
async function lookupBilling(db, name, password) {
  const nameLower = String(name).trim().toLowerCase()

  const snap = await db
    .collection("customers")
    .where("name_lowercase", "==", nameLower)
    .get()

  if (snap.empty) {
    // Generic failure — don't reveal whether the name exists.
    return { ok: false, reason: "invalid" }
  }

  let matchedCustomer = null

  for (const doc of snap.docs) {
    const customer = doc.data()

    if (!customer.password_hash) {
      // Customer predates the password_hash migration (see docs/PUBLIC_BILLING_API.md) —
      // can't verify identity yet, so treat as invalid rather than leaking that they exist.
      continue
    }

    const matches = await bcrypt.compare(password, customer.password_hash)
    if (matches) {
      matchedCustomer = { id: doc.id, ...customer }
      break
    }
  }

  if (!matchedCustomer) {
    return { ok: false, reason: "invalid" }
  }

  const invoicesSnap = await db
    .collection("invoices")
    .where("customer_id", "==", matchedCustomer.id)
    .get()

  const invoices = invoicesSnap.docs.map((d) => d.data())

  const openInvoices = invoices
    .filter((inv) => inv.status === "unpaid" || inv.status === "partial")
    .sort((a, b) => a.month.localeCompare(b.month))

  if (openInvoices.length > 0) {
    return {
      ok: true,
      data: {
        status: "belum-lunas",
        unpaidMonths: openInvoices.map((inv) => ({
          month: inv.month,
          due: inv.amount,
          paid: inv.paid_amount || 0,
          remaining: inv.amount - (inv.paid_amount || 0),
        })),
      },
    }
  }

  const paidInvoices = invoices
    .filter((inv) => inv.status === "paid")
    .sort((a, b) => b.month.localeCompare(a.month))

  if (paidInvoices.length > 0) {
    const latest = paidInvoices[0]
    return {
      ok: true,
      data: {
        status: "lunas",
        lastPaidMonth: latest.month,
        lastPaidDate: latest.paid_at ? latest.paid_at.toDate().toISOString() : null,
      },
    }
  }

  return { ok: true, data: { status: "tidak-ada-tagihan" } }
}

module.exports = { lookupBilling }
