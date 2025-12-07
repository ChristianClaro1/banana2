import React, { useState, useEffect } from 'react';

const presets = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom Range' },
];

const AuditFilters = ({ availableActions = [], users = [], roles = [], onChange }) => {
  const [preset, setPreset] = useState('7days');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [selectedActions, setSelectedActions] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    onChange({ preset, start, end, selectedActions, userQuery, role });
  }, [preset, start, end, selectedActions, userQuery, role]);

  const toggleAction = (a) => {
    setSelectedActions(s => s.includes(a) ? s.filter(x => x !== a) : [...s, a]);
  };

  return (
    <div className="audit-filters">
      <div className="filter-presets">
        {presets.map(p => (
          <button
            key={p.key}
            className={`preset-btn ${preset === p.key ? 'active' : ''}`}
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="custom-range">
            <input type="date" value={start} onChange={e => setStart(e.target.value)} />
            <span>—</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        )}
      </div>

      <div className="filter-row">
        <div className="filter-group actions">
          <label>Action Type</label>
          <div className="actions-list">
            {availableActions.map(a => (
              <button
                key={a}
                className={`action-chip ${selectedActions.includes(a) ? 'active' : ''}`}
                onClick={() => toggleAction(a)}
              >{a}</button>
            ))}
          </div>
        </div>

        <div className="filter-group user">
          <label>User</label>
          <input list="users-list" placeholder="Search user" value={userQuery} onChange={e => setUserQuery(e.target.value)} />
          <datalist id="users-list">
            {users.map(u => <option key={u} value={u} />)}
          </datalist>
        </div>

        <div className="filter-group role">
          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="">All</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};

export default AuditFilters;
