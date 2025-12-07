import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import AuditLog from '../models/AuditLog.js';
import OrderRecord from '../models/OrderRecord.js';
import { getStoreFilter } from '../middleware/store.middleware.js';

// Place an order: decrement inventory, create order record, and create Subtracted audit logs
export const placeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { items = [], paymentMethod, userEmail, userRole, discount } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items' });

    session.startTransaction();

    // Create order record first to get an id
    const total = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 0), 0) - (discount || 0);
    // Map incoming items (which use `id`) to OrderRecord schema (uses `itemId`)
    const itemsForRecord = items.map(it => ({ itemId: it.id, name: it.name, qty: it.qty, price: it.price }));
    const orderPayload = { items: itemsForRecord, total, paymentMethod };
    if (req.storeId) orderPayload.storeId = req.storeId;
    const order = await OrderRecord.create([orderPayload], { session });
    const orderId = order[0]._id.toString();

    const updatedItems = [];

    for (const it of items) {
      // If this item corresponds to an inventory item, decrement stock
      if (!it.id) continue;
      const inv = await Inventory.findById(it.id).session(session);
      // ensure inventory belongs to current store (if storeId provided)
      if (req.storeId && inv && String(inv.storeId) !== String(req.storeId)) {
        await session.abortTransaction();
        return res.status(400).json({ error: `Item ${it.name} does not belong to this store` });
      }
      if (!inv) continue;
      const oldStock = Number(inv.stock || 0);
      const qty = Number(it.qty || 0);
      const newStock = oldStock - qty;
      if (newStock < 0) {
        await session.abortTransaction();
        return res.status(400).json({ error: `Insufficient stock for ${it.name}` });
      }
      inv.stock = newStock;
      await inv.save({ session });

      // Prevent duplicate Subtracted logs for same order and item
      const existing = await AuditLog.findOne({ actionType: 'Subtracted', resourceId: it.id, orderId }).session(session);
      if (!existing) {
        const summary = `Sold ${qty}× "${it.name}" — stock: ${oldStock} → ${newStock}`;
        await AuditLog.create([{
          email: userEmail || req.user?.email || 'system@local',
          role: userRole || req.user?.role || 'System',
          actionType: 'Subtracted',
          resourceType: 'Inventory',
          resourceId: it.id,
          target: it.name,
          changes: [{ field: 'stock', before: oldStock, after: newStock }],
          message: summary,
          summary,
          orderId,
          ...(req.storeId ? { storeId: req.storeId } : {}),
          date: new Date()
        }], { session });
      }

      updatedItems.push({ id: inv._id.toString(), stock: inv.stock, name: inv.name });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ orderId, updatedItems });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Place order error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export default { placeOrder };
