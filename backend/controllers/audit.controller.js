import AuditLog from "../models/AuditLog.js";
import { getStoreFilter } from "../middleware/store.middleware.js";

export const getLogs = async (req, res) => {
  const filter = getStoreFilter(req);
  const logs = await AuditLog.find(filter).sort({ createdAt: -1 });
  res.json(logs);
};

export const createLog = async (req, res) => {
  const toCreate = { ...req.body, ...(req.storeId ? { storeId: req.storeId } : {}) };
  const log = await AuditLog.create(toCreate);
  res.status(201).json(log);
};