// src/services/dashboard.service.js

const { db } = require("./firestore.service");
const admin = require("firebase-admin");

exports.updateAfterInvoicePaid = async (invoice) => {
  const monthRef = db.collection("monthly_stats").doc(invoice.month);

  await monthRef.set(
    {
      paid_count: admin.firestore.FieldValue.increment(1),
      unpaid_count: admin.firestore.FieldValue.increment(-1),
      total_revenue: admin.firestore.FieldValue.increment(invoice.paid_amount),
      total_outstanding: admin.firestore.FieldValue.increment(
        -(invoice.amount - invoice.paid_amount)
      ),
      auto_subscribed_count: invoice.auto_subscribed
        ? admin.firestore.FieldValue.increment(1)
        : admin.firestore.FieldValue.increment(0),
      updated_at: Date.now(),
    },
    { merge: true }
  );
};

exports.updateAfterInvoiceCreated = async (invoice) => {
 const monthRef = db.collection("monthly_stats").doc(invoice.month);

 await monthRef.set(
   {
     total_invoice: admin.firestore.FieldValue.increment(1),
     unpaid_count: admin.firestore.FieldValue.increment(1),
     total_outstanding: admin.firestore.FieldValue.increment(invoice.amount),
     updated_at: Date.now(),
   },
   { merge: true }
 );
};
