import Sales from "../models/Sales.js";
import Orders from "../models/Order.js";
import OrderRecord from "../models/OrderRecord.js";
import Products from "../models/Product.js";

// 1. Weekly sales (global)
export const getWeeklySales = async () => {
  // Prefer Sales aggregation if available
  try {
    const res = await Sales.aggregate([
      {
        $group: {
          _id: "$date",
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    if (res && res.length) return res;
  } catch (e) {
    // ignore and fallback
  }

  // Fallback: aggregate from OrderRecord by day
  return await OrderRecord.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: "$total" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

// 2. Today's summary (global)
export const getTodaySummary = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Use OrderRecord as primary source for totals and orders
  const todaysOrderRecords = await OrderRecord.find({ createdAt: { $gte: today } });

  let totalSales = 0;
  let totalOrders = 0;
  const customers = new Set();

  if (todaysOrderRecords && todaysOrderRecords.length) {
    totalOrders = todaysOrderRecords.length;
    totalSales = todaysOrderRecords.reduce((s, o) => s + (o.total || 0), 0);
    todaysOrderRecords.forEach(o => { if (o.customerId) customers.add(String(o.customerId)); });
  } else {
    // fallback to legacy Orders collection (per-item entries)
    const todaysOrders = await Orders.find({ createdAt: { $gte: today } });
    totalOrders = todaysOrders.length;
    totalSales = todaysOrders.reduce((s, o) => s + ((o.price || 0) * (o.qty || 0)), 0);
    todaysOrders.forEach(o => { if (o.customerId) customers.add(String(o.customerId)); });
  }

  const totalCustomers = customers.size;
  const avgSale = totalOrders > 0 ? totalSales / totalOrders : 0;

  return { totalSales, totalCustomers, totalOrders, avgSale };
};

// 3. Recent Orders (global)
export const getRecentOrders = async (storeId = null, limit = 10) => {
  const filter = {};
  if (storeId) filter.storeId = storeId;

  // Prefer OrderRecord (aggregated orders)
  const recs = await OrderRecord.find(filter).sort({ createdAt: -1 }).limit(limit);

  // Normalize shape for frontend compatibility
  return recs.map(r => {
    const quantity = (r.items || []).reduce((s, it) => s + (it.qty || 0), 0);
    const itemName = r.items && r.items.length === 1 ? r.items[0].name : `${r.items.length} items`;
    return {
      _id: r._id,
      itemName,
      quantity,
      totalAmount: r.total || 0,
      paymentMethod: r.paymentMethod || '',
      createdAt: r.createdAt,
      customerId: r.customerId || null,
    };
  });
};

// 4. Popular Products (global)
export const getPopularProducts = async () => {
  return await Products.find()
    .sort({ sold: -1 })
    .limit(5);
};