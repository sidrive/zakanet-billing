// src/controllers/dashboard.controller.js

const { db } = require("../services/firestore.service");

exports.getSummary = async (req, res) => {
  try {
    const month = req.query.month;

    const doc = await db.collection("monthly_stats").doc(month).get();

    if (!doc.exists) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: doc.data() });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ success: false });
  }
};
