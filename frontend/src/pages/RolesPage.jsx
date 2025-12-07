import React, { useState, useEffect } from "react";
import API from "../api";
import "../pages-css/roles.css";
import logo from "../assets/salespoint-logo.png";

const ROLE_OPTIONS = ['Owner','Admin','Manager','Staff'];
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const PHONE_REGEX = /^[0-9]{10,13}$/;

const Roles = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editData, setEditData] = useState({ name: "", email: "", role: "", phone: "", hiringDate: "" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "", phone: "" });
  const [addErrors, setAddErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState({ show: false, index: null });
  const [showEditConfirm, setShowEditConfirm] = useState({ show: false });

  // Fetch users from backend
  const fetchUsers = async (q = '') => {
    try {
      const params = q ? { params: { q } } : {};
      const { data } = await API.get('/roles', params);
      if (Array.isArray(data)) setUsers(data);
      else setUsers([]);
    } catch (err) {
      console.error("Failed to load roles:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // realtime client-side filtering while keeping backend-sourced list
    if (!searchTerm) { fetchUsers(); return; }
    // Use backend search for accurate results
    const t = setTimeout(() => fetchUsers(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const filteredUsers = Array.isArray(users)
    ? users.filter((user) => {
        const hay = `${user.name || ''} ${user.email || ''} ${user.role || ''} ${user.phone || ''}`.toLowerCase();
        return hay.includes(searchTerm.toLowerCase());
      })
    : [];

  // Delete user with confirmation modal
  const confirmDelete = (index) => setShowDeleteConfirm({ show: true, index });
  const cancelDelete = () => setShowDeleteConfirm({ show: false, index: null });
  const doDelete = async () => {
    const index = showDeleteConfirm.index;
    if (index == null) return;
    const user = users[index];
    try {
      await API.delete(`/roles/${user._id}`);
      setUsers(users.filter((_, i) => i !== index));
      cancelDelete();
      setDeleteError('');
    } catch (err) {
      console.error(err);
      setDeleteError(err?.response?.data?.message || 'Failed to delete user');
    }
  };

  // Edit user
  const handleEdit = (index) => {
    setEditingIndex(index);
    const u = users[index];
    setEditData({ name: u.name || '', email: u.email || '', role: u.role || '', phone: u.phone || '', hiringDate: u.hiringDate || u.hiringDate || '' });
    setEditErrors({});
    setFormError('');
  };

  const requestSave = () => setShowEditConfirm({ show: true });
  const cancelSave = () => setShowEditConfirm({ show: false });
  const doSave = async () => {
    if (editingIndex == null) return;
    const user = users[editingIndex];
    // client-side validation -> collect errors
    const errors = {};
    if (!editData.name) errors.name = 'Name is required';
    if (!editData.email) errors.email = 'Email is required';
    else if (!EMAIL_REGEX.test(editData.email)) errors.email = 'Invalid email format';
    if (!editData.role) errors.role = 'Role is required';
    else if (!ROLE_OPTIONS.includes(editData.role)) errors.role = 'Invalid role';
    if (!editData.phone) errors.phone = 'Phone is required';
    else if (!PHONE_REGEX.test(String(editData.phone))) errors.phone = 'Phone must be 10-13 digits';

    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setFormError('');
      const { data: updated } = await API.put(`/roles/${user._id}`, {
        name: editData.name,
        email: editData.email,
        role: editData.role,
        phone: editData.phone
      });
      const newUsers = [...users];
      newUsers[editingIndex] = updated;
      setUsers(newUsers);
      setEditingIndex(null);
      setEditData({ name: "", email: "", role: "", phone: "", hiringDate: "" });
      cancelSave();
    } catch (err) {
      console.error("Update failed:", err);
      setFormError(err?.response?.data?.message || "Failed to update user");
    }
  };

  // Add new user
  const handleAddUser = async () => {
    const errors = {};
    if (!newUser.name) errors.name = 'Name is required';
    if (!newUser.email) errors.email = 'Email is required';
    else if (!EMAIL_REGEX.test(newUser.email)) errors.email = 'Invalid email format';
    if (!newUser.role) errors.role = 'Role is required';
    else if (!ROLE_OPTIONS.includes(newUser.role)) errors.role = 'Invalid role';
    if (!newUser.phone) errors.phone = 'Phone is required';
    else if (!PHONE_REGEX.test(String(newUser.phone))) errors.phone = 'Phone must be 10-13 digits';

    setAddErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setFormError('');
      const { data: created } = await API.post('/roles', newUser);
      setUsers((prev) => [created, ...prev]);
      setShowAddModal(false);
      setNewUser({ name: "", email: "", role: "", phone: "" });
      setAddErrors({});
    } catch (err) {
      console.error("Create failed:", err);
      setFormError(err?.response?.data?.message || "Failed to create user");
    }
  };

  return (
    <div className="dashboard">
      <main className="main-content">
        <header className="top-bar">
          <div className="header-left">
            <img src={logo} alt="Sales Point Logo" className="header-logo" />
            <input
              type="text"
              placeholder="Search users by name, email, role or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="top-icons">
            <div className="user-info">
              <span className="user-name">John Doe</span>
              <span className="user-role">Owner</span>
            </div>
            <button onClick={() => setShowAddModal(true)} className="add-btn">
              + Add User
            </button>
          </div>
        </header>

        <section className="roles-section">
          <h2>User Roles</h2>
          <table className="roles-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Hiring Date</th>
                <th>Phone Number</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.hiringDate ? new Date(user.hiringDate).toLocaleString() : ''}</td>
                  <td>{user.phone}</td>
                  <td>{user.status || 'active'}</td>
                  <td>
                    <button className="edit-btn" onClick={() => handleEdit(index)}>
                      ✏️
                    </button>
                    <button className="delete-btn" onClick={() => confirmDelete(index)}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Edit Modal */}
        {editingIndex !== null && (
          <div className="roles-modal-overlay">
            <div className="roles-modal-content">
              <h3>Edit User</h3>
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="Name"
                required
              />
              {editErrors.name && <div className="field-error">{editErrors.name}</div>}
              <input
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                placeholder="Email"
                required
              />
              {editErrors.email && <div className="field-error">{editErrors.email}</div>}
              <select value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} required>
                <option value="">Select role</option>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {editErrors.role && <div className="field-error">{editErrors.role}</div>}
              <div className="readonly-field">
                <label>Hiring Date</label>
                <div>{editData.hiringDate ? new Date(editData.hiringDate).toLocaleString() : '—'}</div>
              </div>
              <input
                type="text"
                value={editData.phone}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                placeholder="Phone"
                required
              />
              {editErrors.phone && <div className="field-error">{editErrors.phone}</div>}
              {formError && <div className="form-error">{formError}</div>}
              <div className="modal-buttons">
                <button onClick={requestSave}>Save</button>
                <button onClick={() => setEditingIndex(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Confirmation Modal */}
        {showEditConfirm.show && (
          <div className="modal">
            <div className="modal-content">
              <h3>Confirm Edit</h3>
              <p>Are you sure you want to save these changes? This action will be logged.</p>
              <div className="modal-buttons">
                <button onClick={doSave}>Yes, save</button>
                <button onClick={cancelSave}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm.show && (
          <div className="modal">
            <div className="modal-content">
              <h3>Confirm Delete</h3>
              <p>Are you sure you want to delete this user? This action will be logged and cannot be undone.</p>
              {deleteError && <div className="form-error">{deleteError}</div>}
              <div className="modal-buttons">
                <button onClick={doDelete}>Yes, delete</button>
                <button onClick={cancelDelete}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {showAddModal && (
          <div className="roles-modal-overlay">
            <div className="roles-modal-content">
              <h3>Add New User</h3>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Name"
                required
              />
              {addErrors.name && <div className="field-error">{addErrors.name}</div>}
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="Email"
                required
              />
              {addErrors.email && <div className="field-error">{addErrors.email}</div>}
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} required>
                <option value="">Select role</option>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {addErrors.role && <div className="field-error">{addErrors.role}</div>}
              <input
                type="text"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="Phone"
                required
              />
              {addErrors.phone && <div className="field-error">{addErrors.phone}</div>}
              {formError && <div className="form-error">{formError}</div>}
              <div className="modal-note">Hiring date is auto-assigned and cannot be edited.</div>
              <div className="modal-buttons">
                <button onClick={handleAddUser}>Add</button>
                <button onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Roles;
