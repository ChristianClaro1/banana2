// backend/controllers/roles.controller.js
import Role from "../models/Role.js";
import Shift from "../models/Shift.js";
import AuditLog from "../models/AuditLog.js";
import { getStoreFilter } from "../middleware/store.middleware.js";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const PHONE_REGEX = /^[0-9]{10,13}$/;

const getUserFromReq = (req) => {
  const email = req.user?.email || req.body?.userEmail || 'system@local';
  const role = req.user?.role || req.body?.userRole || 'System';
  return { email, role };
};

// Get all roles
export const getRoles = async (req, res) => {
  try {
    const filter = getStoreFilter(req);
    // Exclude soft-deleted
    const base = { ...(filter || {}), is_deleted: false };

    // Support search via ?q=term
    const q = (req.query.q || req.query.search || '').trim();
    let roles;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      roles = await Role.find({
        ...base,
        $or: [
          { name: re },
          { email: re },
          { role: re },
          { phone: re }
        ]
      }).sort({ createdAt: -1 });
    } else {
      roles = await Role.find(base).sort({ createdAt: -1 });
    }
    res.json(roles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch roles" });
  }
};

// Create a new role
export const createRole = async (req, res) => {
  try {
    const { name, email, role: roleName, phone } = req.body;
    const filter = getStoreFilter(req);

    // Basic required validation
    if (!name || !email || !roleName || !phone) return res.status(400).json({ message: 'Missing required fields' });

    // Validate formats
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Invalid email format' });
    if (!PHONE_REGEX.test(String(phone))) return res.status(400).json({ message: 'Invalid phone format' });

    // Validate role enum
    const allowed = ['Owner','Admin','Manager','Staff'];
    if (!allowed.includes(roleName)) return res.status(400).json({ message: 'Invalid role' });

    // Prevent duplicate emails within same store
    const existing = await Role.findOne({ email, ...(filter || {}) });
    if (existing) return res.status(400).json({ message: "Email already exists" });

    // Prepare creation payload — hiringDate assigned server-side; ignore any client-provided hiringDate
    const toCreate = {
      name,
      email,
      role: roleName,
      phone: String(phone),
      hiringDate: new Date(),
      ...(req.storeId ? { storeId: req.storeId } : {})
    };

    const role = await Role.create(toCreate);

    // Create default morning shifts for the new role for the current week (Mon-Fri)
    try {
      const today = new Date();
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day; // compute Monday
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);

      const shiftsToCreate = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        shiftsToCreate.push({
          employeeId: role._id,
          date: dateStr,
          type: 'morning',
          start: '06:00',
          end: '14:00',
          status: 'assigned'
        });
      }
      // attach storeId to shifts if present
      if (req.storeId) shiftsToCreate.forEach(s => s.storeId = req.storeId);
      await Shift.insertMany(shiftsToCreate);
    } catch (shiftErr) {
      console.error('Failed to create default shifts for new role:', shiftErr);
    }

    // Audit log: Created new user
    try {
      const user = getUserFromReq(req);
      const summary = `Created new user ${role.name} with role ${role.role}.`;
      await AuditLog.create({
        email: user.email,
        role: user.role,
        actionType: 'Created',
        resourceType: 'User',
        resourceId: role._id.toString(),
        target: role.name,
        summary,
        message: summary,
        date: new Date(),
        ...(req.storeId ? { storeId: req.storeId } : {})
      });
    } catch (e) {
      console.error('Failed to write audit log (create role):', e);
    }

    res.status(201).json(role);//stop
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create role" });
  }
};

// Update role
export const updateRole = async (req, res) => {
  try {
    const id = req.params.id;
    const filter = getStoreFilter(req);
    const before = await Role.findOne({ _id: id, ...filter }).lean();

    if (!before) return res.status(404).json({ message: 'Role not found' });

    // Prevent editing hiringDate or is_deleted via API
    const payload = { ...req.body };
    delete payload.hiringDate;
    delete payload.is_deleted;

    // If email is changing, ensure uniqueness
    if (payload.email && String(payload.email) !== String(before.email)) {
      if (!EMAIL_REGEX.test(payload.email)) return res.status(400).json({ message: 'Invalid email format' });
      const conflict = await Role.findOne({ email: payload.email, _id: { $ne: id }, ...(filter || {}) });
      if (conflict) return res.status(400).json({ message: 'Email already exists' });
    }

    // If phone provided, validate
    if (payload.phone && !PHONE_REGEX.test(String(payload.phone))) return res.status(400).json({ message: 'Invalid phone format' });

    // If role provided, validate enum
    const allowed = ['Owner','Admin','Manager','Staff'];
    if (payload.role && !allowed.includes(payload.role)) return res.status(400).json({ message: 'Invalid role' });

    const role = await Role.findOneAndUpdate({ _id: id, ...filter }, payload, { new: true, runValidators: true });
    if (!role) return res.status(404).json({ message: "Role not found" });

    // Audit log: Edited user — build diff summary
    try {
      const user = getUserFromReq(req);
      const fields = ['name','email','phone','role'];
      const diffs = [];
      if (before) {
        fields.forEach(f => {
          const bv = before[f];
          const av = role[f];
          if (String(bv) !== String(av)) diffs.push(`${f} (${bv} → ${av})`);
        });
      }
      const summary = diffs.length > 0 ? `Updated user ${role.name}: ${diffs.join(', ')}.` : `Updated user ${role.name}.`;
      await AuditLog.create({
        email: user.email,
        role: user.role,
        actionType: 'Edited',
        resourceType: 'User',
        resourceId: role._id.toString(),
        target: role.name,
        summary,
        message: summary,
        changes: diffs.map(d => {
          // parse 'field (old → new)' into structured change if possible
          const m = d.match(/^([^(]+) \((.*) → (.*)\)$/);
          if (m) return { field: m[1].trim(), before: m[2].trim(), after: m[3].trim() };
          return { field: d, before: null, after: null };
        }),
        date: new Date(),
        ...(req.storeId ? { storeId: req.storeId } : {})
      });
    } catch (e) {
      console.error('Failed to write audit log (update role):', e);
    }

    res.json(role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update role" });
  }
};

// Delete role
export const deleteRole = async (req, res) => {
  try {
    const id = req.params.id;
    const filter = getStoreFilter(req);
    // Soft delete: set is_deleted = true
    const role = await Role.findOneAndUpdate({ _id: id, ...filter }, { is_deleted: true }, { new: true });
    if (!role) return res.status(404).json({ message: "Role not found" });

    // Audit log: Deleted user
    try {
      const user = getUserFromReq(req);
      const summary = `Deleted user ${role.name} (previous role: ${role.role}).`;
      await AuditLog.create({
        email: user.email,
        role: user.role,
        actionType: 'Deleted',
        resourceType: 'User',
        resourceId: id,
        target: role.name,
        summary,
        message: summary,
        date: new Date(),
        ...(req.storeId ? { storeId: req.storeId } : {})
      });
    } catch (e) {
      console.error('Failed to write audit log (delete role):', e);
    }

    res.json({ message: "Role deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete role" });
  }
};
