import React from 'react';

const AuditModal = ({ log, onClose }) => {
  if (!log) return null;

  // Prefer structured changes when available
  const changes = (log.changes && log.changes.length) ? log.changes : [];

  return (
    <div className="audit-modal-overlay" onClick={onClose}>
      <div className="audit-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h3>Audit Details</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>
        <div className="modal-body">
          <div className="meta-row"><strong>Timestamp:</strong> <span className="mono">{new Date(log.date || log.createdAt).toLocaleString()}</span></div>
          <div className="meta-row"><strong>User:</strong> {log.email} <span className="muted">· {log.role}</span></div>
          {/* Normalize 'Delete' display to 'Deleted' for clarity */}
          <div className="meta-row"><strong>Action:</strong> {(log.actionType === 'Delete' ? 'Deleted' : (log.actionType || '—'))}</div>
          <div className="meta-row"><strong>Target:</strong> {log.target || '—'}</div>
          {log.orderId && <div className="meta-row"><strong>Order ID:</strong> {log.orderId}</div>}

          <section className="details-section">
            <h4>Details</h4>
            {changes.length > 0 ? (
              <table className="changes-table">
                <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                <tbody>
                  {changes.map((c, i) => (
                    <tr key={i}><td>{c.field}</td><td>{String(c.before)}</td><td>{String(c.after)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div>
                {log.summary ? <div className="action-summary">{log.summary}</div> : <pre className="action-raw">{log.action || log.message}</pre>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AuditModal;
