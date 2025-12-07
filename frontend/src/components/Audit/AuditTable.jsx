import React from 'react';

const ActionBadge = ({ type }) => {
  // Normalize a few legacy/variant labels and map to CSS classes
  const classMap = {
    Created: 'badge-blue',
    Edited: 'badge-yellow',
    Deleted: 'badge-red',
    // Keep backwards-compatible mapping for legacy values
    Delete: 'badge-red',
    Restocked: 'badge-green',
    Subtracted: 'badge-subtracted',
    Login: 'badge-gray',
    Logout: 'badge-gray'
  };
  // Normalize display names for legacy values
  const displayMap = {
    Delete: 'Deleted'
  };

  const cls = classMap[type] || 'badge-gray';
  const display = displayMap[type] || type || 'Other';
  return <span className={`action-badge ${cls}`}>{display}</span>;
};

const SortIndicator = ({ dir }) => (
  <span className={`sort-ind ${dir === 'asc' ? 'asc' : (dir === 'desc' ? 'desc' : '')}`}>{dir === 'asc' ? '▲' : (dir === 'desc' ? '▼' : '▲')}</span>
);

const AuditTable = ({ data = [], onView, sortBy, sortDirection, onSort }) => {
  return (
    <div className="audit-table">
      <div className="table-head-row">
        <div className={`col ts ${sortBy === 'date' ? 'sorted' : ''}`} tabIndex={0} onClick={() => onSort('date')} onKeyDown={(e)=>{ if(e.key==='Enter') onSort('date')}}>
          Timestamp {sortBy === 'date' && <SortIndicator dir={sortDirection} />}
        </div>
        <div className={`col user ${sortBy === 'email' ? 'sorted' : ''}`} onClick={() => onSort('email')}>User {sortBy === 'email' && <SortIndicator dir={sortDirection} />}</div>
        <div className={`col role ${sortBy === 'role' ? 'sorted' : ''}`} onClick={() => onSort('role')}>Role {sortBy === 'role' && <SortIndicator dir={sortDirection} />}</div>
        <div className={`col actionType ${sortBy === 'actionType' ? 'sorted' : ''}`} onClick={() => onSort('actionType')}>Action {sortBy === 'actionType' && <SortIndicator dir={sortDirection} />}</div>
        <div className="col target">Target</div>
        <div className="col summary">Summary</div>
        <div className="col view"> </div>
      </div>

      <div className="table-body">
        {data.map((log) => (
          <div className={`table-row ${log._id}`} key={log._id}>
            <div className="col ts mono">{new Date(log.date || log.createdAt).toLocaleString()}</div>
            <div className="col user">{log.email}</div>
            <div className="col role">{log.role}</div>
            <div className="col actionType"><ActionBadge type={log.actionType || 'Other'} /></div>
            <div className="col target">{log.target || '-'}</div>
            <div className="col summary">
              {(log.summary || log.message || log.action || '').split('\n').map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
              {log.orderId && <div className="order-id">Order #{log.orderId}</div>}
            </div>
            <div className="col view"><button className="view-btn" onClick={() => onView(log)}>View Details</button></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditTable;
