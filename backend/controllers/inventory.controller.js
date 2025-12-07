import Inventory from "../models/Inventory.js";
import AuditLog from "../models/AuditLog.js";
import { getStoreFilter } from "../middleware/store.middleware.js";

const getUserFromReq = (req) => {
  // try common places for user info; fallback to system
  const email = req.user?.email || req.body?.userEmail || 'system@local';
  const role = req.user?.role || req.body?.userRole || 'System';
  return { email, role };
};

export const getAll = async (req, res) => {
  const filter = getStoreFilter(req);
  const items = await Inventory.find(filter);
  res.json(items);
};

export const create = async (req, res) => {
  const payload = { ...req.body, ...(req.storeId ? { storeId: req.storeId } : {}) };
  const item = await Inventory.create(payload);

  // Audit log
  try {
    const user = getUserFromReq(req);
    const action = `Created item "${item.name}" (category: ${item.category}, stock: ${item.stock}, price: ${item.price})`;
    const changes = [
      { field: 'name', before: null, after: item.name },
      { field: 'category', before: null, after: item.category },
      { field: 'stock', before: null, after: item.stock },
      { field: 'price', before: null, after: item.price }
    ];
    await AuditLog.create({
      email: user.email,
      role: user.role,
      actionType: 'Created',
      resourceType: 'Inventory',
      resourceId: item._id?.toString?.() || String(item._id),
      target: item.name,
      changes,
      message: action,
      action,
      date: new Date(),
      ...(req.storeId ? { storeId: req.storeId } : {})
    });
  } catch (e) {
    console.error('Failed to write audit log (create):', e);
  }

  res.status(201).json(item);
};

export const update = async (req, res) => {
  const id = req.params.id;
  const filter = getStoreFilter(req);
  const before = await Inventory.findOne({ _id: id, ...filter }).lean();
  const after = await Inventory.findOneAndUpdate({ _id: id, ...filter }, req.body, { new: true });

  // Build change summary
  try {
    const user = getUserFromReq(req);
    const fields = ['name','category','stock','price'];
    const changes = [];
    if (before) {
      fields.forEach(f => {
        const bv = before[f];
        const av = after[f];
        if (String(bv) !== String(av)) changes.push({ field: f, before: bv, after: av });
      });
    }
    const action = changes.length > 0
      ? `Edited item "${after?.name || id}" — ${changes.map(c=>`${c.field}: ${c.before} -> ${c.after}`).join('; ')}`
      : `Edited item "${after?.name || id}"`;
    await AuditLog.create({
      email: user.email,
      role: user.role,
      actionType: 'Edited',
      resourceType: 'Inventory',
      resourceId: id,
      target: after?.name,
      changes,
      message: action,
      action,
      date: new Date()
    , ...(req.storeId ? { storeId: req.storeId } : {})
    });
  } catch (e) {
    console.error('Failed to write audit log (update):', e);
  }

  res.json(after);
};

export const remove = async (req, res) => {
  const id = req.params.id;
  const filter = getStoreFilter(req);
  const before = await Inventory.findOne({ _id: id, ...filter }).lean();
  await Inventory.findOneAndDelete({ _id: id, ...filter });

  try {
    const user = getUserFromReq(req);
    const action = before ? `Deleted item "${before.name}" (id: ${id})` : `Deleted item id ${id}`;
    const changes = before ? [
      { field: 'name', before: before.name, after: null },
      { field: 'category', before: before.category, after: null },
      { field: 'stock', before: before.stock, after: null },
      { field: 'price', before: before.price, after: null }
    ] : [];
    await AuditLog.create({
      email: user.email,
      role: user.role,
      actionType: 'Deleted',
      resourceType: 'Inventory',
      resourceId: id,
      target: before?.name,
      changes,
      message: action,
      action,
      date: new Date()
    , ...(req.storeId ? { storeId: req.storeId } : {})
    });
  } catch (e) {
    console.error('Failed to write audit log (delete):', e);
  }

  res.json({ message: "Deleted" });
};