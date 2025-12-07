import express from "express";
import mongoose from 'mongoose';
import Shift from "../models/Shift.js";
import Role from "../models/Role.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

// Helpers for time/overlap checks
const timeToMinutes = (t) => {
  if (!t || typeof t !== 'string') return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
};

// Given a shift-like object with { date, start, end }, return interval in ms
const getIntervalMs = (shift) => {
  const base = new Date(shift.date + 'T00:00:00Z').getTime();
  const sMin = timeToMinutes(shift.start);
  const eMin = timeToMinutes(shift.end);
  if (sMin == null || eMin == null) return null;
  const startMs = base + sMin * 60 * 1000;
  let endMs = base + eMin * 60 * 1000;
  if (eMin <= sMin) {
    // overnight: end is on next day
    endMs = base + (eMin + 24 * 60) * 60 * 1000;
  }
  return { startMs, endMs };
};

const intervalsOverlap = (a, b) => {
  if (!a || !b) return false;
  return a.startMs < b.endMs && b.startMs < a.endMs;
};

const getUserFromReq = (req) => {
  const email = req.user?.email || req.body?.userEmail || 'system@local';
  const role = req.user?.role || req.body?.userRole || 'Admin';
  return { email, role };
};

// Get all employees (for shift page)
router.get("/employees", async (req, res) => {
  try {
    const employees = await Role.find();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get shifts for a week (pass weekStart=YYYY-MM-DD)
// Mounted at `/api/shifts` so use root path here
router.get("/", async (req, res) => {
  try {
    const { weekStart } = req.query;
    if (weekStart) {
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const shifts = await Shift.find({ date: { $gte: startStr, $lte: endStr } });
      return res.json(shifts);
    }

    const shifts = await Shift.find();
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a new shift (single)
router.post("/", async (req, res) => {
  try {
    const { employeeId, date, type, start, end, status } = req.body;
    // Server-side overlap validation: only when start and end provided
    if (start && end) {
      // fetch possible conflicting shifts for this employee around the date (prev, same, next)
      const d = new Date(date);
      const prev = new Date(d); prev.setDate(d.getDate() - 1);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const dates = [prev, d, next].map(x => x.toISOString().split('T')[0]);
      const existing = await Shift.find({ employeeId, date: { $in: dates } }).lean();
      const newInt = getIntervalMs({ date, start, end });
      for (const ex of existing) {
        const exInt = getIntervalMs(ex);
        if (exInt && intervalsOverlap(newInt, exInt)) {
          return res.status(400).json({ message: `Shift overlaps with existing shift on ${ex.date}` });
        }
      }
    }
    const shift = new Shift({ employeeId, date, type, start, end, status });
    await shift.save();
    // Create audit log for assigned shift
    try {
      const performer = getUserFromReq(req);
      const employee = await Role.findById(employeeId).lean();
      const empName = employee?.name || String(employeeId);
      const summary = `Assigned shift to ${empName}: ${start || ''}–${end || ''} on ${date}`;
      await AuditLog.create({
        email: performer.email,
        role: performer.role,
        actionType: 'Created',
        resourceType: 'Shift',
        resourceId: shift._id.toString(),
        target: empName,
        summary,
        message: summary,
        date: new Date()
      });
    } catch (e) {
      console.error('Failed to write audit log (create shift):', e);
    }

    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bulk replace/create shifts
// Accepts an array of shift objects: [{ employeeId, date, type, start, end, status }, ...]
router.post("/bulk", async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ message: 'Expected an array of shifts' });
    // Separate deletion requests from create/update requests.
    // Deletion items should be objects with `{ employeeId, date, _delete: true }`.
    const deletions = items.filter(i => i && i._delete).map(d => ({ employeeId: d.employeeId, date: d.date }));
    const toCreate = items.filter(i => i && !i._delete);

    const performer = getUserFromReq(req);

    // Prepare audit actions after DB operations
    const auditEntries = [];

    // Handle deletions: fetch existing shifts to log details, then delete
    if (deletions.length) {
      // Find shifts for deletion
      const delQueries = deletions.map(d => ({ employeeId: d.employeeId, date: d.date }));
      const shiftsToDelete = await Shift.find({ $or: delQueries }).lean();
      // Perform deletions
      const delPromises = deletions.map(d => Shift.deleteMany({ employeeId: d.employeeId, date: d.date }));
      await Promise.all(delPromises);

      // Build audit logs for deleted shifts
      for (const s of shiftsToDelete) {
        try {
          const emp = await Role.findById(s.employeeId).lean();
          const empName = emp?.name || String(s.employeeId);
          const time = s.start && s.end ? `${s.start}–${s.end}` : (s.start || s.end || '');
          const summary = `Removed shift for ${empName} on ${s.date}: ${time}`;
          auditEntries.push({
            email: performer.email,
            role: performer.role,
            actionType: 'Deleted',
            resourceType: 'Shift',
            resourceId: s._id?.toString(),
            target: empName,
            summary,
            message: summary,
            date: new Date()
          });
        } catch (e) {
          console.error('Failed preparing audit log for deletion:', e);
        }
      }
    }

    // Handle creations/updates.
    if (toCreate.length) {
      // Validate overlaps before making DB changes.
      // Group toCreate by employeeId for efficient checks.
      const byEmp = new Map();
      let minDate = null, maxDate = null;
      toCreate.forEach(i => {
        if (!byEmp.has(i.employeeId)) byEmp.set(i.employeeId, []);
        byEmp.get(i.employeeId).push(i);
        const d = i.date;
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      });

      // For each employee, fetch existing shifts in range [minDate -1, maxDate +1], excluding those that will be replaced
      for (const [empId, newShifts] of byEmp.entries()) {
        const startWindow = new Date(minDate); startWindow.setDate(startWindow.getDate() - 1);
        const endWindow = new Date(maxDate); endWindow.setDate(endWindow.getDate() + 1);
        const startStr = startWindow.toISOString().split('T')[0];
        const endStr = endWindow.toISOString().split('T')[0];

        // Build set of pairs that will be replaced so we can exclude them from conflict checks
        const replacingPairs = new Set(newShifts.map(s => `${s.employeeId}::${s.date}`));

        const existing = await Shift.find({ employeeId: empId, date: { $gte: startStr, $lte: endStr } }).lean();
        const existingFiltered = existing.filter(es => !replacingPairs.has(`${es.employeeId}::${es.date}`));

        // Build intervals for existing
        const existingIntervals = existingFiltered.map(es => ({ src: es, int: getIntervalMs(es) })).filter(x => x.int);

        // Also prepare intervals for newShifts (to check among themselves)
        const newIntervals = newShifts.map(ns => ({ src: ns, int: getIntervalMs(ns) }));

        // Check new vs existing
        for (const ni of newIntervals) {
          if (!ni.int) continue; // cannot validate shifts without start/end
          for (const ei of existingIntervals) {
            if (intervalsOverlap(ni.int, ei.int)) {
              return res.status(400).json({ message: `Overlap detected for employee ${empId} between new shift on ${ni.src.date} and existing shift on ${ei.src.date}` });
            }
          }
        }

        // Check new vs new (same employee)
        for (let i = 0; i < newIntervals.length; i++) {
          const a = newIntervals[i];
          if (!a.int) continue;
          for (let j = i + 1; j < newIntervals.length; j++) {
            const b = newIntervals[j];
            if (!b.int) continue;
            if (intervalsOverlap(a.int, b.int)) {
              return res.status(400).json({ message: `Overlap detected for employee ${empId} between new shifts on ${a.src.date} and ${b.src.date}` });
            }
          }
        }
      }

      // Build list of unique (employeeId,date) pairs
      const pairs = toCreate.map(i => `${i.employeeId}::${i.date}`);
      const uniquePairs = Array.from(new Set(pairs));

      // Fetch existing shifts for those pairs to detect edits
      const orQueries = uniquePairs.map(p => {
        const [employeeId, date] = p.split('::');
        return { employeeId, date };
      });
      const existingShifts = await Shift.find({ $or: orQueries }).lean();
      const existingMap = new Map();
      for (const es of existingShifts) {
        existingMap.set(`${es.employeeId}::${es.date}`, es);
      }

      // Remove existing shifts for those pairs, then insert new ones
      const removeExisting = uniquePairs.map(p => {
        const [employeeId, date] = p.split('::');
        return Shift.deleteMany({ employeeId, date });
      });
      await Promise.all(removeExisting);

      const created = await Shift.insertMany(toCreate);

      // For each created shift, determine whether it replaced an existing one (edit) or is new (create)
      for (const c of created) {
        try {
          const key = `${c.employeeId}::${c.date}`;
          const before = existingMap.get(key);
          const emp = await Role.findById(c.employeeId).lean();
          const empName = emp?.name || String(c.employeeId);
          if (before) {
            // Determine if time changed or status changed
            const oldTime = (before.start && before.end) ? `${before.start}–${before.end}` : (before.start || before.end || '');
            const newTime = (c.start && c.end) ? `${c.start}–${c.end}` : (c.start || c.end || '');
            if (oldTime !== newTime || before.status !== c.status) {
              let summary = '';
              if (before.status !== c.status && c.status === 'off') {
                summary = `Marked ${empName} as Off on ${c.date}`;
              } else if (oldTime !== newTime) {
                summary = `Updated shift for ${empName} on ${c.date}: ${oldTime} → ${newTime}`;
              } else {
                summary = `Updated shift for ${empName} on ${c.date}.`;
              }
              auditEntries.push({
                email: performer.email,
                role: performer.role,
                actionType: 'Edit',
                resourceType: 'Shift',
                resourceId: c._id?.toString(),
                target: empName,
                summary,
                message: summary,
                date: new Date()
              });
            }
          } else {
            const summary = `Assigned shift to ${empName}: ${c.start || ''}–${c.end || ''} on ${c.date}`;
            auditEntries.push({
              email: performer.email,
              role: performer.role,
              actionType: 'Created',
              resourceType: 'Shift',
              resourceId: c._id?.toString(),
              target: empName,
              summary,
              message: summary,
              date: new Date()
            });
          }
        } catch (e) {
          console.error('Failed preparing audit log for created shift:', e);
        }
      }

      try {
        if (auditEntries.length) {
          await AuditLog.insertMany(auditEntries);
          // clear auditEntries to avoid double-insert below
        }
      } catch (e) {
        console.error('Failed to write bulk audit logs after create:', e);
      }

      return res.status(201).json(created);
    }

    // If only deletions were requested, insert audit logs and respond with success and count
    if (auditEntries.length) {
      try {
        await AuditLog.insertMany(auditEntries);
      } catch (e) {
        console.error('Failed to write bulk audit logs:', e);
      }
    }
    return res.status(200).json({ deleted: deletions.length });
  } catch (err) {
    console.error('Bulk shifts error', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
