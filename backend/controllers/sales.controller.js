import Sales from "../models/Sales.js";
import { getStoreFilter } from "../middleware/store.middleware.js";

// Get last 7 days sales
export const getWeeklySales = async (req, res) => {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);

    const filter = { date: { $gte: sevenDaysAgo, $lte: today }, ...getStoreFilter(req) };
    const sales = await Sales.find(filter).sort({ date: 1 });

    const formatted = sales.map((s) => ({
      date: s.date.toISOString().split("T")[0],
      total: s.total,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
