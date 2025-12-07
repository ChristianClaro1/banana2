import {
  getWeeklySales,
  getTodaySummary,
  getRecentOrders,
  getPopularProducts,
} from "../services/dashboard.service.js";

export const getDashboardData = async (req, res) => {
  try {
    const storeId = req.storeId || null;
    const weeklySales = await getWeeklySales(storeId);
    const summary = await getTodaySummary(storeId);
    const recentOrders = await getRecentOrders(storeId);
    const popularProducts = await getPopularProducts(storeId);

    res.json({
      weeklySales,
      summary,
      recentOrders,
      popularProducts,
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
