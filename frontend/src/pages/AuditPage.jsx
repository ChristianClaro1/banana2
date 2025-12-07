import React, { useState, useEffect, useMemo } from 'react';
import API from '../api';
import '../pages-css/audit.css';
import logo from '../assets/salespoint-logo.png';
import AuditFilters from '../components/Audit/AuditFilters';
import AuditTable from '../components/Audit/AuditTable';
import AuditModal from '../components/Audit/AuditModal';

function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // filter & sort state
  const [filterSpec, setFilterSpec] = useState({});
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // modal
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    setLoading(true);
    API.get('/audit')
      .then(res => {
        const data = res.data;
        // normalize logs: prefer structured fields from backend when present, fall back to heuristic parsing
        const normalized = data.map(d => {
          const legacyText = d.action || d.message || '';

          // Prefer structured actionType if provided by backend
          let actionType = d.actionType || 'Other';
          if (!d.actionType) {
            const t = legacyText.toLowerCase();
            if (t.includes('created')) actionType = 'Created';
            else if (t.includes('edited') || t.includes('updated')) actionType = 'Edited';
            else if (t.includes('deleted')) actionType = 'Deleted';
            else if (t.includes('restock') || t.includes('restocked')) actionType = 'Restocked';
            else if (t.includes('login')) actionType = 'Login';
            else if (t.includes('logout')) actionType = 'Logout';
          }

          // Prefer structured target if provided
          let target = d.target || null;
          if (!target) {
            const quoteMatch = legacyText.match(/"([^"]+)"/);
            if (quoteMatch) target = quoteMatch[1];
            else {
              const onMatch = legacyText.match(/on\s+([A-Za-z0-9 _-]+)/i);
              if (onMatch) target = onMatch[1].trim();
            }
          }

          return { ...d, actionType, target };
        });
        setAuditLogs(normalized);
        setLoading(false);
      })
      .catch(err => { console.error('Failed to load audit logs:', err); setLoading(false); });
  }, []);

  const availableActions = useMemo(() => Array.from(new Set(auditLogs.map(l => l.actionType).filter(Boolean))), [auditLogs]);
  const users = useMemo(() => Array.from(new Set(auditLogs.map(l => l.email).filter(Boolean))), [auditLogs]);
  const roles = useMemo(() => Array.from(new Set(auditLogs.map(l => l.role).filter(Boolean))), [auditLogs]);

  const handleFilterChange = (spec) => setFilterSpec(spec);

  // filtering logic
  const filtered = useMemo(() => {
    if (!auditLogs) return [];
    const { preset, start, end, selectedActions = [], userQuery = '', role = '' } = filterSpec || {};
    let list = auditLogs.slice();

    // date range
    let from = null, to = null;
    const now = new Date();
    if (preset === 'today') { from = new Date(); from.setHours(0,0,0,0); to = new Date(); }
    else if (preset === '7days') { from = new Date(Date.now() - 7*24*3600*1000); to = now; }
    else if (preset === '30days') { from = new Date(Date.now() - 30*24*3600*1000); to = now; }
    else if (preset === 'custom' && start) { from = new Date(start); if (end) to = new Date(end); }

    if (from) {
      list = list.filter(l => {
        const d = new Date(l.date || l.createdAt);
        if (to) return d >= from && d <= (to instanceof Date ? to : new Date(to).setHours(23,59,59,999));
        return d >= from;
      });
    }

    // actions
    if (selectedActions && selectedActions.length > 0) {
      list = list.filter(l => selectedActions.includes(l.actionType));
    }

    // user
    if (userQuery && userQuery.trim() !== '') {
      const q = userQuery.toLowerCase();
      list = list.filter(l => (l.email || '').toLowerCase().includes(q));
    }

    // role
    if (role && role !== '') {
      list = list.filter(l => l.role === role);
    }

    // sorting
    list.sort((a,b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'date') return (new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)) * dir;
      const av = (a[sortBy] || '').toString().toLowerCase();
      const bv = (b[sortBy] || '').toString().toLowerCase();
      if (av < bv) return -1 * dir; if (av > bv) return 1 * dir; return 0;
    });

    return list;
  }, [auditLogs, filterSpec, sortBy, sortDirection]);

  const handleSort = (col) => {
    if (sortBy !== col) { setSortBy(col); setSortDirection('asc'); return; }
    if (sortDirection === 'asc') setSortDirection('desc');
    else if (sortDirection === 'desc') { setSortBy(null); setSortDirection(null); }
  };

  return (
    <div className="dashboard">
      <main className="main-content">
        <header className="top-bar">
          <div className="logo-container"><img src={logo} alt="Sales Point Logo" className="logo" /></div>
          <div className="page-title"><h2>Audit Logs</h2></div>
        </header>

        <section className="audit-section">
          <AuditFilters availableActions={availableActions} users={users} roles={roles} onChange={handleFilterChange} />

          <div className="audit-table-wrapper">
            {loading ? <p className="empty-log">Loading...</p> : (
              filtered.length > 0 ? (
                <>
                  <AuditTable data={filtered} onView={setSelectedLog} sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>No audit activity found.</h3>
                  <p>System actions performed by staff will appear here, including edits, deletions, restocks, and more.</p>
                </div>
              )
            )}
          </div>

          <div className="audit-overview-card">
            <h3>Audit Overview</h3>
            <p>All actions taken by employees are logged here for review. This helps maintain accountability and track system changes.</p>
          </div>
        </section>

        {selectedLog && <AuditModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
      </main>
    </div>
  );
}

export default AuditLogsPage;
