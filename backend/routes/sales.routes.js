// backend/routes/sales.routes.js
import express from "express";
import Sales from "../models/Sales.js";

const router = express.Router();

// GET /api/sales/week
router.get("/week", async (req, res) => {
  try {
    // Get last 7 days sales
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6); // Last 7 days

    const sales = await Sales.find({
      date: { $gte: sevenDaysAgo, $lte: today }
    }).sort({ date: 1 });

    // Format data
    const formatted = sales.map(s => ({
      date: s.date.toISOString().split("T")[0],
      total: s.total
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
