import React, { useState, useEffect, useRef } from "react";
import API from "../api";
import "../pages-css/shift.css";
import logo from '../assets/salespoint-logo.png';

export default function ShiftSchedule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return monday;
  });

  const [employees, setEmployees] = useState([]);
  const safeEmployees = employees || [];
  const [shifts, setShifts] = useState({});
  const [employeeAvailability, setEmployeeAvailability] = useState({}); // { empId: [YYYY-MM-DD] }
  const [serverSnapshot, setServerSnapshot] = useState({}); // snapshot of server shifts to detect deletions

  // Modals
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState({ employee: null, date: null });
  const [shiftType, setShiftType] = useState("morning");
  const [shiftTime, setShiftTime] = useState({ start: "", end: "" });
  // Move shifts modal when employee is on leave
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveInfo, setMoveInfo] = useState({ empId: null, fromDate: null });
  const [selectedMoveDate, setSelectedMoveDate] = useState(null);
  // Employee actions and On Leave tracking
  const [, setShowEmployeeActionsModal] = useState(false);
  const [employeeLeaveDays, setEmployeeLeaveDays] = useState({}); // { empId: [YYYY-MM-DD] }
  // Undo state for leave removals
  const [undoInfo, setUndoInfo] = useState(null); // { empId, removed, prevSnapshot }
  const undoTimerRef = useRef(null);

  const defaultShiftTimes = {
    morning: { start: "06:00", end: "14:00" },
    afternoon: { start: "14:00", end: "22:00" },
    night: { start: "22:00", end: "06:00" },
    flexible: { start: "", end: "" }
  };

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Helper to deep-merge two shift maps { empId: { date: [shifts] } }
  const mergeShiftMaps = (a = {}, b = {}) => {
    const out = { ...a };
    Object.entries(b).forEach(([empId, days]) => {
      out[empId] = { ...(a[empId] || {}), ...(days || {}) };
    });
    return out;
  };

  // Normalize shifts map: remove exact-duplicate shifts per employee/date (by type+start+end)
  const normalizeShiftsMap = (src = {}) => {
    const out = {};
    Object.entries(src).forEach(([empId, days]) => {
      out[empId] = out[empId] || {};
      Object.entries(days || {}).forEach(([date, dayShifts]) => {
        const seen = new Set();
        const deduped = [];
        (dayShifts || []).forEach(s => {
          const key = `${s.type}::${s.time?.start || ''}::${s.time?.end || ''}`;
          if (!seen.has(key)) { seen.add(key); deduped.push(s); }
        });
        out[empId][date] = deduped;
      });
    });
    return out;
  };

  useEffect(() => {
    // Fetch employees from backend roles endpoint
    const fetchEmployees = async () => {
      try {
        const res = await API.get(`/roles`);
        const roles = res.data || [];
        const emps = roles.map(r => ({ id: r._id, name: r.name }));
        setEmployees(emps);

        const initShifts = {};
        const availability = {};
        emps.forEach(emp => { initShifts[emp.id] = {}; availability[emp.id] = []; });
        setShifts(initShifts);
        setEmployeeAvailability(availability);
      } catch (err) {
        console.error("Failed to load roles for shifts:", err);
        // fallback to a small default so UI remains usable
        const mockEmployees = [ { id: 1, name: "John Doe" } ];
        setEmployees(mockEmployees);
      }
    };
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Load settings (incl. shiftMode) so rotation behavior follows settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await API.get(`/settings`);
        const settingsArray = res.data || [];
        const obj = {};
        settingsArray.forEach(s => (obj[s.key] = s.value));
        if (obj.shiftMode) setShiftMode(obj.shiftMode);
      } catch (err) {
        console.error('Failed to load settings for shift page:', err);
      }
    };
    fetchSettings();
  }, []);

  // Load shifts for the current week whenever week changes
  useEffect(() => {
    const loadWeekShifts = async () => {
      try {
        const weekStartStr = weekDates[0].toISOString().split('T')[0];
        const res = await API.get(`/shifts?weekStart=${weekStartStr}`);
        const serverShifts = res.data || [];

        // Build shifts map { empId: { date: [shift,...] } }
        const map = {};
        serverShifts.forEach(s => {
          const emp = s.employeeId?.toString() || s.employeeId;
          map[emp] = map[emp] || {};
          map[emp][s.date] = map[emp][s.date] || [];
          map[emp][s.date].push({ type: s.type, time: { start: s.start || defaultShiftTimes[s.type]?.start || '', end: s.end || defaultShiftTimes[s.type]?.end || '' }, status: s.status });
        });

        // Merge into existing shifts state (preserve local-only entries)
        setShifts(prev => mergeShiftMaps(prev, map));

        // Auto-fill missing shifts is expensive and can create very large payloads
        // (e.g. filling entire trimesters/years). Limit auto-fill to a small safe
        // window (next 30 days) to avoid huge bulk saves that can cause OOM.
        try {
          const filled = JSON.parse(JSON.stringify(map));
          const now = new Date(weekDates[0]);
          const windowStart = new Date(now);
          const windowEnd = new Date(now);
          windowEnd.setDate(windowEnd.getDate() + 30); // only auto-fill next 30 days
          let madeChanges = false;

          const getDatesBetween = (start, end) => {
            const dates = [];
            let d = new Date(start);
            while (d <= end) {
              dates.push(new Date(d));
              d.setDate(d.getDate() + 1);
            }
            return dates;
          };

          const buildTrimestersForYear = (yr) => ([
            { start: new Date(yr, 0, 1), end: new Date(yr, 3, 30) },
            { start: new Date(yr, 4, 1), end: new Date(yr, 7, 31) },
            { start: new Date(yr, 8, 1), end: new Date(yr, 11, 31) },
          ]);

          // For each employee with at least one shift, use earliest shift as pivot
          const allEmpIds = Array.from(new Set([...Object.keys(filled), ...employees.map(e => e.id?.toString ? e.id.toString() : e.id)]));
          for (const empId of allEmpIds) {
            const empMap = filled[empId] || {};
            const dates = Object.keys(empMap).sort();
            if (!dates.length) continue; // no pivot
            const pivotDateStr = dates[0];
            const pivotShifts = empMap[pivotDateStr] || [];
            if (!pivotShifts.length) continue;
            const pivotShiftType = pivotShifts[0].type;
            const pivotDate = new Date(pivotDateStr + 'T00:00:00');

            // Only consider trimesters that intersect our small auto-fill window
            const yrsToCheck = [pivotDate.getFullYear(), pivotDate.getFullYear() + 1];
            for (const yr of yrsToCheck) {
              const yrsTris = buildTrimestersForYear(yr);
              for (const tri of yrsTris) {
                // compute intersection between tri and our window
                const triStart = tri.start;
                const triEnd = tri.end;
                const start = triStart > windowStart ? triStart : windowStart;
                const end = triEnd < windowEnd ? triEnd : windowEnd;
                if (end < start) continue;
                const triDates = getDatesBetween(start, end);
                for (const d of triDates) {
                  const dStr = d.toISOString().split('T')[0];
                  if (empMap[dStr] && empMap[dStr].length) continue; // already assigned
                  const assigned = computeAssignedShiftByTrimester(pivotShiftType, pivotDate, d);
                  if (!filled[empId]) filled[empId] = {};
                  filled[empId][dStr] = [{ type: assigned, time: defaultShiftTimes[assigned] || { start: '', end: '' }, status: 'assigned' }];
                  madeChanges = true;
                }
              }
            }
          }

          if (madeChanges) {
            // Merge filled into server-provided map and persist a safe payload
            const merged = mergeShiftMaps(map, filled);
            const normalizedMerged = normalizeShiftsMap(merged);
            // Update local state (merge into current state safely)
            setShifts(prev => normalizeShiftsMap(mergeShiftMaps(prev, filled)));
            await saveShiftsToServer({ silent: true }, normalizedMerged);
          }
        } catch (e) {
          console.error('Auto-fill rotation failed:', e);
        }

        // Save server snapshot for deletion detection
        setServerSnapshot(JSON.parse(JSON.stringify(map)));

        // Build availability: employees with shifts should be available on those dates;
        // employees without shifts for a date remain OFF.
        const availability = {};
        const allEmpIds = Array.from(new Set([...Object.keys(map), ...employees.map(e => e.id?.toString ? e.id.toString() : e.id)]));
        allEmpIds.forEach(empId => {
          availability[empId] = Object.keys(map[empId] || {});
        });
        setEmployeeAvailability(availability);
      } catch (err) {
        console.error('Failed to load week shifts:', err);
      }
    };
    loadWeekShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeekStart]); // Only rerun when week changes

  // Save current shifts to backend (bulk)
  // opts: { silent } - do not show alerts
  // shiftsArg: optional snapshot to save instead of current state
  const saveShiftsToServer = async (opts = { silent: false }, shiftsArg = null) => {
    try {
      const source = shiftsArg || shifts;
      // Flatten shifts state into array of shift objects
      const payload = [];
      Object.entries(source).forEach(([empId, days]) => {
        if (String(empId).startsWith('temp-')) return;
        Object.entries(days).forEach(([date, dayShifts]) => {
          dayShifts.forEach(s => {
            payload.push({ employeeId: empId, date, type: s.type, start: s.time?.start || '', end: s.time?.end || '', status: s.status || 'assigned' });
          });
        });
      });

      // Add deletion markers for any server-side shift that no longer exists in source
      const deletionMarkers = [];
      Object.entries(serverSnapshot || {}).forEach(([empId, days]) => {
        Object.keys(days || {}).forEach(date => {
          const present = source[empId] && Array.isArray(source[empId][date]) && source[empId][date].length > 0;
          if (!present) deletionMarkers.push({ employeeId: empId, date, _delete: true });
        });
      });

      // Additional: detect server-side shifts that would overlap with new shifts and add deletion markers
      // Helpers to compute intervals similar to backend
      const timeToMinutes = (t) => {
        if (!t || typeof t !== 'string') return null;
        const [hh, mm] = t.split(":").map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
        return hh * 60 + mm;
      };
      const getIntervalMs = (shift) => {
        const base = new Date(shift.date + 'T00:00:00Z').getTime();
        const sMin = timeToMinutes(shift.start);
        const eMin = timeToMinutes(shift.end);
        if (sMin == null || eMin == null) return null;
        const startMs = base + sMin * 60 * 1000;
        let endMs = base + eMin * 60 * 1000;
        if (eMin <= sMin) endMs = base + (eMin + 24 * 60) * 60 * 1000;
        return { startMs, endMs };
      };
      const intervalsOverlap = (a, b) => {
        if (!a || !b) return false;
        return a.startMs < b.endMs && b.startMs < a.endMs;
      };

      // Build list of new (non-deletion) intervals to compare against serverSnapshot
      const newIntervals = payload.map(p => ({ src: p, int: getIntervalMs(p) }));
      Object.entries(serverSnapshot || {}).forEach(([empId, days]) => {
          Object.entries(days || {}).forEach(([date, dayShifts]) => {
            // dayShifts might be array of shift objects from serverSnapshot
          // For each server-side shift on this date, check if any new interval overlaps
          const serverShiftList = dayShifts || [];
          for (const ss of serverShiftList) {
            const serverShift = { employeeId: empId, date, start: ss.time?.start || ss.start || '', end: ss.time?.end || ss.end || '' };
            const serverInt = getIntervalMs(serverShift);
            if (!serverInt) continue;
            for (const ni of newIntervals) {
              if (!ni.int) continue;
              // Only consider overlaps for the same employee
              if (String(ni.src.employeeId) !== String(empId)) continue;
              if (intervalsOverlap(ni.int, serverInt)) {
                // add deletion marker if not already scheduled
                const exists = deletionMarkers.find(d => d.employeeId === empId && d.date === date);
                if (!exists) deletionMarkers.push({ employeeId: empId, date, _delete: true });
                break;
              }
            }
          }
        });
      });

      const finalPayload = [...payload, ...deletionMarkers];
      if (finalPayload.length === 0) {
        if (!opts.silent) alert('No shifts to save or only temporary employees present');
        return null;
      }

      const res = await API.post('/shifts/bulk', finalPayload);
      if (!opts.silent) alert(`Saved shifts`);

      // update server snapshot to reflect the saved state
      setServerSnapshot(JSON.parse(JSON.stringify(source)));
      return res;
    } catch (err) {
      // surface server-provided messages when available
      const serverMsg = err?.response?.data?.message || err?.message || 'Unknown error';
      console.error('Failed to save shifts:', err, serverMsg);
      if (!opts.silent) alert(`Failed to save shifts: ${serverMsg}`);
      // throw a normalized Error so callers can inspect message
      const e = new Error(serverMsg);
      e.original = err;
      throw e;
    }
  };

  const prevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  // Helper: get Monday (week start) for a given date
  const getWeekStartMonday = (date) => {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // if Sunday, go back 6 days
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0,0,0,0);
    return monday;
  };

  // countShiftsInMonth removed — calendar now shows date-only view (no per-employee counts)


  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Removed unused: openEmployeeModal
  const saveEmployee = async () => {
    if (!newEmployeeName.trim()) return alert("Please enter a name");
    try {
      const payload = { name: newEmployeeName, email: `${Date.now()}@local`, role: 'Employee', date: new Date().toISOString().split('T')[0], phone: '' };
      const res = await API.post('/roles', payload);
      const created = res.data;
      const newEmp = { id: created._id, name: created.name };
      setEmployees(prev => [...prev, newEmp]);
      setShifts(prev => ({ ...prev, [newEmp.id]: {} }));
      setEmployeeAvailability(prev => ({ ...prev, [newEmp.id]: [] }));
      setShowEmployeeModal(false);//here
      // Fetch the shifts for the current week (backend creates default morning shifts)
      try {
        const weekStartStr = weekDates[0].toISOString().split('T')[0];
        const res2 = await API.get(`/shifts?weekStart=${weekStartStr}`);
        const serverShifts = res2.data || [];
        const map = {};
        serverShifts.forEach(s => {
          const emp = s.employeeId?.toString() || s.employeeId;
          map[emp] = map[emp] || {};
          map[emp][s.date] = map[emp][s.date] || [];
          map[emp][s.date].push({ type: s.type, time: { start: s.start || defaultShiftTimes[s.type]?.start || '', end: s.end || defaultShiftTimes[s.type]?.end || '' }, status: s.status });
        });
        setShifts(prev => mergeShiftMaps(prev, map));
      } catch (e) {
        console.error('Failed to load shifts after creating employee:', e);
      }
    } catch (err) {//stop
      console.error('Failed to create employee role:', err?.response || err);
      alert(err.response?.data?.message || 'Failed to add employee');
    }
  };

  // Removed unused: refreshEmployees

  const openShiftModal = (employee, date) => {
    setSelectedShift({ employee, date });
    // default shift type should follow current shiftMode's first option
    const rotations = {
      "tri-shift": ["morning", "afternoon", "night"],
      "dual-shift": ["morning", "afternoon"],
      "single-shift": ["morning"],
    };
    const available = rotations[shiftMode] || rotations["tri-shift"];
    const defaultType = available[0] || "morning";
    setShiftType(defaultType);
    setShiftTime(defaultShiftTimes[defaultType]);
    setShowShiftModal(true);
  };

  const shiftColorClass = type => {
    switch (type) {
      case "morning": return "red";
      case "afternoon": return "blue";
      case "night": return "green";
      case "flexible": return "yellow";
      default: return "red";
    }
  };

  const calculateShiftHours = (time) => {
    if (!time.start || !time.end) return 0;
    const [startH, startM] = time.start.split(":").map(Number);
    const [endH, endM] = time.end.split(":").map(Number);

    let start = startH + startM / 60;
    let end = endH + endM / 60;
    if (end <= start) end += 24;
    return ((end - start) || 0).toFixed(1);
  };

  const parseTimeToDecimal = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h + m / 60;
  };

  // Helpers: map a date to trimester index, compute equivalent date in another trimester
  const getTrimesterIndexForDate = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    for (let i = 0; i < trimesters.length; i++) {
      const { start, end } = trimesters[i];
      const s = new Date(start); s.setHours(0,0,0,0);
      const e = new Date(end); e.setHours(23,59,59,999);
      if (d >= s && d <= e) return i;
    }
    return -1;
  };

  const getEquivalentDateInTrimester = (date, targetTrimesterIdx) => {
    const srcIdx = getTrimesterIndexForDate(date);
    if (srcIdx === -1) return null;
    const srcTrim = trimesters[srcIdx];
    const tgtTrim = trimesters[targetTrimesterIdx];
    if (!tgtTrim) return null;
    const srcStart = new Date(srcTrim.start); srcStart.setHours(0,0,0,0);
    const tgtStart = new Date(tgtTrim.start); tgtStart.setHours(0,0,0,0);
    const d = new Date(date); d.setHours(0,0,0,0);
    const offsetDays = Math.round((d - srcStart) / (24 * 60 * 60 * 1000));
    const candidate = new Date(tgtStart);
    candidate.setDate(candidate.getDate() + offsetDays);
    if (candidate < tgtTrim.start || candidate > tgtTrim.end) return null;
    return candidate;
  };
  // Rotation helpers using trimester (semester) delta so rotation persists across years
  // Map a date to a global trimester index (year * 3 + localTrimIndex)
  const getGlobalTrimesterIndex = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const m = d.getMonth();
    // local trimester mapping: Jan-Apr => 0, May-Aug => 1, Sep-Dec => 2
    let local = 0;
    if (m >= 0 && m <= 3) local = 0;
    else if (m >= 4 && m <= 7) local = 1;
    else local = 2;
    return year * 3 + local;
  };

  const computeAssignedShiftByTrimester = (baseShift, baseDate, targetDate) => {
    const rotations = {
      "tri-shift": ["morning", "afternoon", "night"],
      "dual-shift": ["morning", "afternoon"],
      "single-shift": [baseShift || "morning"],
    };
    const mode = shiftMode || "tri-shift";
    const rotation = rotations[mode] || rotations["tri-shift"];
    const baseIdx = Math.max(0, rotation.indexOf(baseShift));
    const baseTrim = getGlobalTrimesterIndex(baseDate);
    const targetTrim = getGlobalTrimesterIndex(targetDate);
    const delta = targetTrim - baseTrim;
    const rotLen = rotation.length || 1;
    const shiftIdx = ((baseIdx + delta) % rotLen + rotLen) % rotLen;
    return rotation[shiftIdx] || rotation[0];
  };

  const addShift = async () => {
    const dateStr = selectedShift.date.toISOString().split('T')[0];
    const empId = selectedShift.employee.id;
    const employeeShifts = { ...(shifts[empId] || {}) };
    const dayShifts = employeeShifts[dateStr] || [];

    const newStart = parseTimeToDecimal(shiftTime.start);
    const newEnd = parseTimeToDecimal(shiftTime.end);
    const overlap = dayShifts.some(s => {
      const sStart = parseTimeToDecimal(s.time.start);
      const sEnd = parseTimeToDecimal(s.time.end);
      // handle overnight by normalizing end <= start to next-day in decimal space
      let ns = newStart, ne = newEnd;
      let ss = sStart, se = sEnd;
      if (ne <= ns) ne += 24;
      if (se <= ss) se += 24;
      return (ns < se && ne > ss);
    });
    if (overlap) { alert("Shift overlaps with existing shift!"); return; }

    const newDay = [...dayShifts, { type: shiftType, time: shiftTime }];
    employeeShifts[dateStr] = newDay;
    const newShifts = { ...shifts, [empId]: employeeShifts };

    // Propagate this single-day assignment across equivalent dates in other trimesters
    const baseDate = selectedShift.date;
    const baseTrimIdx = getTrimesterIndexForDate(baseDate);
    if (baseTrimIdx !== -1) {
      for (let t = 0; t < trimesters.length; t++) {
        const eqDate = getEquivalentDateInTrimester(baseDate, t);
        if (!eqDate) continue;
        const eqStr = eqDate.toISOString().split('T')[0];
        const assigned = computeAssignedShiftByTrimester(shiftType, baseDate, eqDate);
        if (!newShifts[empId]) newShifts[empId] = {};
        newShifts[empId][eqStr] = [ { type: assigned, time: defaultShiftTimes[assigned] || { start: '', end: '' }, status: 'assigned' } ];
      }
    }

    const normalized = normalizeShiftsMap(newShifts);
    setShifts(normalized);
    // mark availability for affected dates
    setEmployeeAvailability(prev => {
      const avail = new Set(prev[empId] || []);
      Object.keys(newShifts[empId] || {}).forEach(d => avail.add(d));
      return { ...prev, [empId]: Array.from(avail) };
    });

    // auto-save the change
    try {
      await saveShiftsToServer({ silent: true }, normalized);
    } catch (e) { console.error('Auto-save failed after addShift', e); }
  };

  const getTotalHours = (empId) => {
    const empShifts = shifts[empId] || {};
    let total = 0;
    Object.values(empShifts).forEach(dayShifts => {
      dayShifts.forEach(s => total += Number(calculateShiftHours(s.time)));
    });
    return total.toFixed(1);
  };

  // --- Auto Assignment ---
  // Removed unused: autoAssignShifts

  // Toggle availability
  const toggleAvailability = (empId, dateStr) => {
    setEmployeeAvailability(prev => {
      const avail = prev[empId] || [];
      const isAvail = avail.includes(dateStr);
      // If currently available and user is turning off
      if (isAvail) {
        const dayShifts = (shifts[empId] || {})[dateStr] || [];
        if (dayShifts.length > 0) {
          // Open the On Leave picker (reuse move modal design) and preselect this date
          setMoveInfo({ empId });
          setSelectedMoveDate(dateStr);
          setShowMoveModal(true);
          return prev; // do not change availability yet until user confirms
        }
        return { ...prev, [empId]: avail.filter(d => d !== dateStr) };
      }
      // turning on
      return { ...prev, [empId]: [...avail, dateStr] };
    });
  };

  // moveShiftsToDate removed: moving/cascading shifts is no longer supported.

  // Removed unused: handleMonthlyShiftAssignment

  // Trisemester definitions
  const trimesters = [
    {
      name: "1st Trimester",
      start: new Date(new Date().getFullYear(), 0, 1), // Jan 1
      end: new Date(new Date().getFullYear(), 3, 30),  // Apr 30
    },
    {
      name: "2nd Trimester",
      start: new Date(new Date().getFullYear(), 4, 1), // May 1
      end: new Date(new Date().getFullYear(), 7, 31),  // Aug 31
    },
    {
      name: "3rd Trimester",
      start: new Date(new Date().getFullYear(), 8, 1), // Sep 1
      end: new Date(new Date().getFullYear(), 11, 31), // Dec 31
    },
  ];

  const [selectedTrimester, setSelectedTrimester] = useState(0);
  const [shiftMode, setShiftMode] = useState("tri-shift");

  const getTrimesterDates = (trimesterIdx) => {
    const { start, end } = trimesters[trimesterIdx];
    const dates = [];
    let d = new Date(start);
    while (d <= end) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };



  const assignTrimesterShift = async (employeeId, shiftType) => {
    try {
      // Use the first day of the selected trimester as the pivot for trimester-based rotation
      const pivot = new Date(trimesters[selectedTrimester].start);
      const newShifts = { ...shifts };
      // For each trimester and each date, compute months delta from pivot and assign rotated shift
      trimesters.forEach((t, idx) => {
        const dates = getTrimesterDates(idx);
        dates.forEach(date => {
          const dateStr = date.toISOString().split('T')[0];
          const assignedShift = computeAssignedShiftByTrimester(shiftType, pivot, date);
          if (!newShifts[employeeId]) newShifts[employeeId] = {};
          newShifts[employeeId][dateStr] = [
            {
              type: assignedShift,
              time: defaultShiftTimes[assignedShift] || { start: "", end: "" },
              status: 'assigned',
            },
          ];
        });
      });

      const normalized = normalizeShiftsMap(newShifts);
      setShifts(normalized);
      await saveShiftsToServer({ silent: false }, normalized);
      alert(`Assigned trimester shifts (rotated by ${shiftMode}).`);
    } catch (error) {
      console.error('Failed to assign trimester shift:', error);
      const msg = error?.message || (error?.original?.response?.data?.message) || 'Failed to assign trimester shift.';
      alert(msg);
    }
  };

  const [activeEmployee, setActiveEmployee] = useState(null);
  
  const handleEmployeeClick = (employeeId) => {
    const opening = activeEmployee !== employeeId;
    setActiveEmployee(opening ? employeeId : null);
    setShowEmployeeActionsModal(opening);
  };

  // Removed unused: handleShiftTypeSelection

  const [calendarView, setCalendarView] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(currentWeekStart.getMonth());
  const [calendarYear, setCalendarYear] = useState(currentWeekStart.getFullYear());
  // calendarViewMode removed — single month view only
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);
  const calendarModalRef = useRef(null);

  useEffect(() => {
    if (calendarView && calendarModalRef.current) {
      try { calendarModalRef.current.focus(); } catch (e) { /* ignore focus errors */ }
    }
  }, [calendarView]);

  // getMonthDates removed — month matrix is built inline in the month-view renderer

  return (
    <div className="shift-page">
      <main className="shift-page-wrapper">
        <header className="top-bar">
          <div className="logo-container"><img src={logo} alt="Logo" className="logo" /></div>
          <input type="text" placeholder="Search employees..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <div className="top-icons"><span className="user">John Doe Owner</span></div>
        </header>

        <div className="shift-controls">
          <div className="week-nav">
            <button onClick={prevWeek}>{"<"}</button>
            <span>Week of {weekDates[0].toLocaleDateString()} - {weekDates[4].toLocaleDateString()}</span>
            <button onClick={nextWeek}>{">"}</button>
            <button
              className="calendar-open-btn"
              title="Open calendar"
              onClick={() => {
                setCalendarView(true);
                setCalendarMonth(currentWeekStart.getMonth());
                setCalendarYear(currentWeekStart.getFullYear());
                setCalendarSelectedDate(currentWeekStart.toISOString().split('T')[0]);
              }}
              style={{ marginLeft: 8 }}
            >
              📅
            </button>
          </div>
          <div className="trisem-select">
            <label htmlFor="trisemester">Trimester:</label>
            <select id="trisemester" value={selectedTrimester} onChange={e => setSelectedTrimester(Number(e.target.value))}>
              {trimesters.map((t, idx) => (
                <option key={t.name} value={idx}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="schedule-card">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Name</th>
                {weekDates.map(d => (
                  <th key={d.toISOString()}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}<br/>
                    <span className="sub">{d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                  </th>
                ))}
                <th>Total Hrs</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div className="employee-name-container">
                      <span
                        className="employee-name"
                        onClick={() => handleEmployeeClick(emp.id)}
                      >
                        {emp.name}
                      </span>
                    </div>
                  </td>
                  {weekDates.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const dayShifts = shifts[emp.id]?.[dateStr] || [];
                    const totalDayHours = dayShifts.reduce((sum, s) => sum + Number(calculateShiftHours(s.time)), 0).toFixed(1);
                    const isOnLeave = (employeeLeaveDays[emp.id] || []).includes(dateStr);
                    // Show Available when there is at least one scheduled shift for the day,
                    // otherwise fall back to availability state. If the day is marked On Leave,
                    // treat it as Off.
                    const available = !isOnLeave && ( (dayShifts && dayShifts.length > 0) || (employeeAvailability[emp.id] && employeeAvailability[emp.id].includes(dateStr)) );

                    return (
                      <td key={dateStr} onClick={() => openShiftModal(emp, date)} title={`Total: ${totalDayHours} hrs`}>
                        <div style={{ fontSize: '10px', color: available ? 'green' : 'gray' }} onClick={e => { e.stopPropagation(); toggleAvailability(emp.id, dateStr); }}>
                          {available ? 'Available' : 'Off'}
                        </div>
                        {dayShifts.length
                                ? dayShifts.map((s, i) => (
                                    <div key={i} className={`shift ${shiftColorClass(s.type)}`} title={`${s.type.toUpperCase()} Shift\n${s.time.start} - ${s.time.end}\n${calculateShiftHours(s.time)} hrs`}>
                                      {s.type !== "flexible" ? `${s.time.start} - ${s.time.end}` : `${s.time.start || ""} - ${s.time.end || ""}`}
                                    </div>
                                  ))
                                : (
                                  (employeeLeaveDays[emp.id] || []).includes(dateStr)
                                    ? <div className="on-leave">On Leave</div>
                                    : <div className="empty">+</div>
                                )
                              }
                      </td>
                    );
                  })}
                  <td>{getTotalHours(emp.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Employee Modal & Shift Modal (same as previous) */}
      {showEmployeeModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add Employee</h3>
            <input type="text" placeholder="Employee Name" value={newEmployeeName} onChange={e => setNewEmployeeName(e.target.value)} />
            <div className="modal-buttons">
              <button onClick={() => setShowEmployeeModal(false)}>Cancel</button>
              <button onClick={saveEmployee}>Save</button>
            </div>
          </div>
        </div>
      )}

        {/* Undo snackbar for On Leave removals */}
        {undoInfo && (
          <div className="undo-snackbar">
            <div className="undo-message">Removed {Object.keys(undoInfo.removed || {}).reduce((acc,d) => acc + (undoInfo.removed[d]?.length||0), 0)} shift(s)</div>
            <div className="undo-actions">
              <button className="undo-btn" onClick={async () => {
                const { empId, prevSnapshot } = undoInfo;
                const restored = JSON.parse(JSON.stringify(prevSnapshot || {}));
                const normalized = normalizeShiftsMap(restored);
                setShifts(normalized);
                setEmployeeAvailability(prev => ({ ...prev, [empId]: Object.keys(normalized[empId] || {}) }));
                // remove leave markers for restored dates
                setEmployeeLeaveDays(ld => {
                  const next = { ...ld };
                  Object.keys(undoInfo.removed || {}).forEach(d => {
                    if (!next[empId]) return;
                    next[empId] = next[empId].filter(x => x !== d);
                  });
                  if (next[empId] && next[empId].length === 0) delete next[empId];
                  return next;
                });
                try { await saveShiftsToServer({ silent: true }, normalized); } catch (e) { console.error('Failed saving after undo', e); }
                if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
                setUndoInfo(null);
              }}>Undo</button>
            </div>
          </div>
        )}

      {showMoveModal && (
        <div className="modal-overlay">
          <div className="modal move-modal">
            <div className="move-header">
              <div>
                <h3 style={{ margin: 0 }}>Mark On Leave</h3>
                <p className="muted">Select a day in the week to mark <strong>{safeEmployees.find(e => e.id === (moveInfo.empId || activeEmployee))?.name}</strong> as On Leave. The shift on that day will be removed.</p>
              </div>
            </div>

            <div className="move-grid">
              {weekDates.map(d => {
                const dStr = d.toISOString().split('T')[0];
                const existing = (shifts[moveInfo.empId || activeEmployee] || {})[dStr] || [];
                return (
                  <div key={dStr} className={`move-card ${selectedMoveDate === dStr ? 'selected' : ''}`} onClick={() => setSelectedMoveDate(dStr)}>
                    <div className="day">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="date">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="count">{existing.length} shifts</div>
                  </div>
                );
              })}
            </div>

            <div className="modal-buttons" style={{ marginTop: 18 }}>
              <button className="btn-secondary" onClick={() => { setShowMoveModal(false); setMoveInfo({ empId: null, fromDate: null }); setSelectedMoveDate(null); }}>Cancel</button>
              <button className="btn-primary" onClick={async () => {
                const empId = moveInfo.empId || activeEmployee;
                if (!empId || !selectedMoveDate) return;
                // perform mark on leave: remove shifts for that date and persist
                const prevSnapshot = JSON.parse(JSON.stringify(shifts || {}));
                const newShifts = JSON.parse(JSON.stringify(shifts || {}));
                const removed = {};
                if (newShifts[empId] && newShifts[empId][selectedMoveDate]) {
                  removed[selectedMoveDate] = newShifts[empId][selectedMoveDate];
                  delete newShifts[empId][selectedMoveDate];
                  if (Object.keys(newShifts[empId]).length === 0) delete newShifts[empId];
                }
                // update availability
                setEmployeeAvailability(prev => {
                  const updated = new Set(prev[empId] || []);
                  updated.delete(selectedMoveDate);
                  return { ...prev, [empId]: Array.from(updated) };
                });
                // mark leave day
                setEmployeeLeaveDays(ld => ({ ...ld, [empId]: Array.from(new Set([...(ld[empId] || []), selectedMoveDate])) }));
                const normalized = normalizeShiftsMap(newShifts);
                setShifts(normalized);
                try {
                  await saveShiftsToServer({ silent: true }, normalized);
                  if (Object.keys(removed).length) {
                    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                    setUndoInfo({ empId, removed, prevSnapshot });
                    undoTimerRef.current = setTimeout(() => { setUndoInfo(null); undoTimerRef.current = null; }, 8000);
                  }
                } catch (e) {
                  console.error('Failed saving on-leave', e);
                  const msg = e?.message || (e?.original?.response?.data?.message) || 'Failed to save on-leave changes';
                  alert(msg);
                }
                setShowMoveModal(false);
                setMoveInfo({ empId: null, fromDate: null });
                setSelectedMoveDate(null);
                setActiveEmployee(null);
              }} disabled={!selectedMoveDate}>Mark Leave</button>
            </div>
          </div>
        </div>
      )}

      {showShiftModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Shifts</h3>
            <div className="shift-list">
              {(shifts[selectedShift.employee.id]?.[selectedShift.date.toISOString().split('T')[0]] || []).map((s, i) => (
                <div key={i} className={`shift-list-item ${shiftColorClass(s.type)}`}>
                  <span>{s.type !== "flexible" ? `${s.time.start} - ${s.time.end}` : `${s.time.start || ""} - ${s.time.end || ""}`} ({s.type})</span>
                  <button className="remove-btn" onClick={async () => {
                    const dateStr = selectedShift.date.toISOString().split('T')[0];
                    const empId = selectedShift.employee.id;
                    const employeeShifts = { ...(shifts[empId] || {}) };
                    const dayShifts = employeeShifts[dateStr] || [];
                    const updatedDayShifts = dayShifts.filter((_, idx) => idx !== i);
                    if (updatedDayShifts.length) {
                      employeeShifts[dateStr] = updatedDayShifts;
                    } else {
                      delete employeeShifts[dateStr];
                    }

                    // Also remove equivalent dates in other trimesters to keep rotation in sync
                    const baseDate = selectedShift.date;
                    const baseTrimIdx = getTrimesterIndexForDate(baseDate);
                    if (baseTrimIdx !== -1) {
                      for (let t = 0; t < trimesters.length; t++) {
                        const eq = getEquivalentDateInTrimester(baseDate, t);
                        if (!eq) continue;
                        const eqStr = eq.toISOString().split('T')[0];
                        if (employeeShifts[eqStr]) delete employeeShifts[eqStr];
                      }
                    }

                    const newShifts = { ...shifts, [empId]: employeeShifts };
                    const normalized = normalizeShiftsMap(newShifts);
                    setShifts(normalized);
                    // update availability: recalc availability from employeeShifts
                    setEmployeeAvailability(prev => {
                      const avail = new Set(prev[empId] || []);
                      // remove any dates that are no longer present
                      Object.keys(prev[empId] || {}).forEach(d => {
                        if (!newShifts[empId] || !newShifts[empId][d]) avail.delete(d);
                      });
                      // ensure availability includes remaining shifts
                      Object.keys(newShifts[empId] || {}).forEach(d => avail.add(d));
                      return { ...prev, [empId]: Array.from(avail) };
                    });
                    try { await saveShiftsToServer({ silent: true }, normalized); } catch (e) { console.error('Auto-save failed after remove', e); }
                  }}>✕</button>
                </div>
              ))}
            </div>

            <div className="modal-field">
              <label>Shift Type</label>
              <select value={shiftType} onChange={e => { setShiftType(e.target.value); setShiftTime(defaultShiftTimes[e.target.value]); }}>
                {(() => {
                  const rotations = {
                    "tri-shift": ["morning", "afternoon", "night"],
                    "dual-shift": ["morning", "afternoon"],
                    "single-shift": ["morning"],
                  };
                  const available = rotations[shiftMode] || rotations["tri-shift"];
                  return (
                    <>
                      {available.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      <option value="flexible">Flexible</option>
                    </>
                  );
                })()}
              </select>
            </div>
            {(shiftType === "flexible" || shiftType === "custom") && (
              <>
                <div className="modal-field">
                  <label>Start Time</label>
                  <input type="time" value={shiftTime.start || ""} onChange={e => setShiftTime(prev => ({ ...prev, start: e.target.value }))} />
                </div>
                <div className="modal-field">
                  <label>End Time</label>
                  <input type="time" value={shiftTime.end || ""} onChange={e => setShiftTime(prev => ({ ...prev, end: e.target.value }))} />
                </div>
              </>
            )}
            <div className="modal-buttons">
              <button onClick={() => setShowShiftModal(false)}>Cancel</button>
              <button onClick={() => { addShift(); setShowShiftModal(false); }}>+ Add Shift</button>
            </div>
          </div>
        </div>
      )}

      {activeEmployee !== null && (
  <div className="modal-overlay">
    <div className="monthly-shift-modal">
      <div className="monthly-shift-modal-header">
        <h3>Assign Trimester Shift</h3>
        <p>Assign a shift for <strong>{safeEmployees.find(e => e.id === activeEmployee)?.name}</strong> for the entire selected trimester. Choose a shift type below:</p>
      </div>
      <div className="monthly-shift-modal-options">
        {(() => {
          const rotations = {
            "tri-shift": ["morning", "afternoon", "night"],
            "dual-shift": ["morning", "afternoon"],
            "single-shift": ["morning"],
          };
          const available = rotations[shiftMode] || rotations["tri-shift"];
          return available.map(t => (
            <button key={t} className={`monthly-shift-modal-btn ${t}`} onClick={() => assignTrimesterShift(activeEmployee, t)}>
              {t === 'morning' ? '☀️' : t === 'afternoon' ? '🌤️' : '🌙'} {t.charAt(0).toUpperCase() + t.slice(1)} Shift <span className="monthly-shift-modal-desc">{defaultShiftTimes[t]?.start || ''} - {defaultShiftTimes[t]?.end || ''}</span>
            </button>
          ));
        })()}
      </div>
      <button className="monthly-shift-modal-cancel" onClick={() => setActiveEmployee(null)}>Cancel</button>
    </div>
  </div>
)}

      {calendarView && (
        <div className="modal-overlay">
          <div className="calendar-modal" role="dialog" aria-modal="true">
            <div className="calendar-modal-header">
              <div className="cal-header-left">
                <button className="cal-arrow" aria-label="Previous month" onClick={() => {
                  const d = new Date(calendarYear, calendarMonth - 1, 1);
                  setCalendarYear(d.getFullYear());
                  setCalendarMonth(d.getMonth());
                }}>◀</button>
              </div>

              <div className="cal-header-center">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select aria-label="Select month" value={calendarMonth} onChange={e => setCalendarMonth(Number(e.target.value))} className="cal-month-select">
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>{new Date(2020, i, 1).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                  </select>
                  <input
                    aria-label="Year"
                    type="number"
                    value={calendarYear}
                    onChange={e => setCalendarYear(Number(e.target.value))}
                    className="cal-year-input"
                  />
                </div>
              </div>

              <div className="cal-header-right">
                <button className="cal-arrow" aria-label="Next month" onClick={() => {
                  const d = new Date(calendarYear, calendarMonth + 1, 1);
                  setCalendarYear(d.getFullYear());
                  setCalendarMonth(d.getMonth());
                }}>▶</button>
                <button className="today-btn" onClick={() => { const today = new Date(); setCalendarYear(today.getFullYear()); setCalendarMonth(today.getMonth()); }}>Today</button>
                <button className="calendar-close" aria-label="Close calendar" onClick={() => setCalendarView(false)}>✕</button>
              </div>
            </div>

            <div className="calendar-body">
              <div className="calendar-weekdays" aria-hidden>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="calendar-weekday">{d}</div>
                ))}
              </div>

              <div className="calendar-grid" role="grid">
                {(() => {
                  // Build month matrix (5-6 rows of 7)
                  const firstOfMonth = new Date(calendarYear, calendarMonth, 1);
                  const startOffset = firstOfMonth.getDay(); // 0-6 (Sun..Sat)
                  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
                  const cells = Array.from({ length: totalCells }, (_, idx) => {
                    const dayNum = idx - startOffset + 1;
                    if (dayNum < 1 || dayNum > daysInMonth) return null;
                    return new Date(calendarYear, calendarMonth, dayNum);
                  });

                  return cells.map((date, idx) => {
                    if (!date) return <div key={idx} className="calendar-empty-grid" />;
                    const dateStr = date.toISOString().split('T')[0];
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;
                    const isSelected = calendarSelectedDate === dateStr;
                    // Simplified date-only cell (no employee/event listings)
                    return (
                      <div key={idx} role="gridcell" className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected-date' : ''}`} onClick={() => { setCalendarSelectedDate(dateStr); const monday = getWeekStartMonday(date); setCurrentWeekStart(monday); setCalendarView(false); }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <div className="date-num">{date.getDate()}</div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
