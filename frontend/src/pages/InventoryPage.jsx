import React, { useState, useEffect, useMemo } from 'react';
import { /* Link, useLocation */ } from 'react-router-dom';
import '../pages-css/inventory.css';
import logo from '../assets/salespoint-logo.png';

const Inventory = () => {
  
  const categories = ["Hot Drinks", "Cold Drinks", "Food", "Snacks"];

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newItem, setNewItem] = useState({ name: '', category: 'Hot Drinks', stock: 0, price: 0 });
  const [addErrors, setAddErrors] = useState({});

  // Sorting & filtering state
  const [filteredItems, setFilteredItems] = useState([]);
  // Default sort: Item name ascending
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'category' | 'stock' | 'price' | 'overall'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc' | null
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilters, setStockFilters] = useState({ low: false, out: false, in: false });
  const [animate, setAnimate] = useState(false);

  // Edit / Restock / Delete states
  const [editingItem, setEditingItem] = useState(null);
  const [restockItem, setRestockItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  // ----------------------------------------
  // Fetch inventory from backend
  // ----------------------------------------
  useEffect(() => {
    const headers = {};
    try {
      const raw = localStorage.getItem('currentStore');
      if (raw) {
        const store = JSON.parse(raw);
        if (store && store._id) headers['x-store-id'] = store._id;
      }
    } catch (e) { }

    fetch(`/api/inventory`, { headers })
      .then(res => res.json())
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, []);

  // Compute filteredItems from search, category and stock filters (Filtering -> Sorting -> Render)
  useEffect(() => {
    let list = items.slice(); // copy original

    // Search filter
    if (searchTerm && searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      list = list.filter(it => (it.name || '').toLowerCase().includes(q));
    }

    // Category filter
    if (selectedCategory && selectedCategory !== 'All') {
      list = list.filter(it => it.category === selectedCategory);
    }

    // Stock filters (can be multiple)
    const active = Object.entries(stockFilters).filter(([k, v]) => v).map(([k]) => k);
    if (active.length > 0) {
      list = list.filter(it => {
        return active.some(f => {
          if (f === 'low') return (Number(it.stock) || 0) < 20 && (Number(it.stock) || 0) > 0;
          if (f === 'out') return Number(it.stock) === 0;
          if (f === 'in') return Number(it.stock) > 0;
          return false;
        });
      });
    }

    // update state and trigger fade animation
    setFilteredItems(list);
    setAnimate(true);
    const t = setTimeout(() => setAnimate(false), 260);
    return () => clearTimeout(t);
  }, [items, searchTerm, selectedCategory, stockFilters]);

  // Sorting (derived from filteredItems, do not mutate original)
  const sortedItems = useMemo(() => {
    const list = filteredItems.slice();
    if (!sortBy) return list;
    const dir = sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let av, bv;
      if (sortBy === 'overall') {
        av = (Number(a.stock) || 0) * (Number(a.price) || 0);
        bv = (Number(b.stock) || 0) * (Number(b.price) || 0);
      } else {
        av = a[sortBy];
        bv = b[sortBy];
      }
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (Number(av) - Number(bv)) * dir;
    });
    return list;
  }, [filteredItems, sortBy, sortDirection]);

  const handleSort = (col) => {
    if (sortBy !== col) {
      setSortBy(col);
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc') setSortDirection('desc');
    else if (sortDirection === 'desc') { setSortBy(null); setSortDirection(null); }
  };

  const calculateOverallCost = (stock, price) => stock * price;

  // ----------------------------------------
  // Add item
  // ----------------------------------------
  const handleAddItem = async (e) => {
    e.preventDefault();
    // client-side validation: stock and price must be > 0
    const errors = {};
    if (!newItem.name || String(newItem.name).trim() === '') errors.name = 'Name is required';
    if (!newItem.category) errors.category = 'Category is required';
    const stockVal = Number(newItem.stock);
    if (isNaN(stockVal) || stockVal <= 0) errors.stock = 'Stock must be greater than 0';
    const priceVal = Number(newItem.price);
    if (isNaN(priceVal) || priceVal <= 0) errors.price = 'Price must be greater than 0';

    setAddErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const headers = { "Content-Type": "application/json" };
      try {
        const raw = localStorage.getItem('currentStore');
        if (raw) {
          const store = JSON.parse(raw);
          if (store && store._id) headers['x-store-id'] = store._id;
        }
      } catch (e) {}

      const res = await fetch(`/api/inventory`, {
        method: "POST",
        headers,
        body: JSON.stringify(newItem),
      });
      const created = await res.json();
      setItems(prev => [...prev, created]);
      setNewItem({ name: '', category: 'Hot Drinks', stock: 0, price: 0 });
      setShowAddModal(false);
      setAddErrors({});
    } catch (err) {
      console.error("Add error:", err);
    }
  };

  // ----------------------------------------
  // Edit item
  // ----------------------------------------
  const handleUpdateItem = async (updatedItem) => {
    try {
      const headers = { "Content-Type": "application/json" };
      try {
        const raw = localStorage.getItem('currentStore');
        if (raw) {
          const store = JSON.parse(raw);
          if (store && store._id) headers['x-store-id'] = store._id;
        }
      } catch (e) {}

      const res = await fetch(`/api/inventory/${updatedItem._id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updatedItem),
      });
      const updated = await res.json();
      const idKey = updated._id || updated.id;
      setItems(prev => prev.map(it => ((it._id === idKey) || (it.id === idKey)) ? updated : it));
      setEditingItem(null);
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  // ----------------------------------------
  // Restock item
  // ----------------------------------------
  const confirmRestock = async (id, added) => {
    const item = items.find(i => (i._id === id) || (i.id === id));
    if (!item) return;
    try {
      const headers = { "Content-Type": "application/json" };
      try {
        const raw = localStorage.getItem('currentStore');
        if (raw) {
          const store = JSON.parse(raw);
          if (store && store._id) headers['x-store-id'] = store._id;
        }
      } catch (e) {}

      const res = await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...item, stock: item.stock + added }),
      });
      const updated = await res.json();
      setItems(prev => prev.map(it => ((it._id === id) || (it.id === id)) ? updated : it));
      setRestockItem(null);
    } catch (err) {
      console.error("Restock error:", err);
    }
  };

  // ----------------------------------------
  // Delete item
  // ----------------------------------------
  const confirmDelete = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      const headers = {};
      try {
        const raw = localStorage.getItem('currentStore');
        if (raw) {
          const store = JSON.parse(raw);
          if (store && store._id) headers['x-store-id'] = store._id;
        }
      } catch (e) {}
      await fetch(`/api/inventory/${id}`, { method: "DELETE", headers });
      setItems(prev => prev.filter(it => !((it._id === id) || (it.id === id))));
      setDeletingItem(null);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // ----------------------------------------
  // Modals
  // ----------------------------------------
  const EditItemForm = ({ item, categories, onSave, onCancel }) => {
    const [form, setForm] = useState({ name: item.name, category: item.category, price: item.price });
    const [errors, setErrors] = useState({});
    const handleSave = () => {
      const err = {};
      if (!form.name || String(form.name).trim() === '') err.name = 'Name is required';
      const p = Number(form.price);
      if (isNaN(p) || p <= 0) err.price = 'Price must be greater than 0';
      if (!form.category) err.category = 'Category is required';
      setErrors(err);
      if (Object.keys(err).length > 0) return;
      onSave({ ...item, ...form, price: Number(form.price) });
    };
    return (
      <div>
        <div className="form-group">
          <label>Item Name:</label>
          <input value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setErrors(prev => ({ ...prev, name: undefined })); }} />
          {errors.name && <div className="field-error">{errors.name}</div>}
        </div>
        <div className="form-group">
          <label>Category:</label>
          <select value={form.category} onChange={e => { setForm({ ...form, category: e.target.value }); setErrors(prev => ({ ...prev, category: undefined })); }}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <div className="field-error">{errors.category}</div>}
        </div>
        <div className="form-group">
          <label>Price:</label>
          <input type="number" min="0" value={form.price} onChange={e => { setForm({ ...form, price: e.target.value }); setErrors(prev => ({ ...prev, price: undefined })); }} />
          {errors.price && <div className="field-error">{errors.price}</div>}
        </div>
        <div className="modal-buttons">
          <button onClick={handleSave}>Save</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  };

  const RestockForm = ({ item, onConfirm, onCancel }) => {
    const [addQty, setAddQty] = useState(0);
    const [errors, setErrors] = useState({});
    const newStock = Number(item.stock) + Number(addQty);
    const handleConfirm = () => {
      const val = Number(addQty);
      const err = {};
      if (isNaN(val) || val <= 0) err.addQty = 'Enter a positive quantity to add';
      setErrors(err);
      if (Object.keys(err).length > 0) return;
      onConfirm(Number(addQty));
    };
    return (
      <div>
        <div className="form-group">
          <label>Item:</label>
          <input value={item.name} readOnly />
        </div>
        <div className="form-group">
          <label>Current Stock:</label>
          <input value={item.stock} readOnly />
        </div>
        <div className="form-group">
          <label>Add Stock:</label>
          <input type="number" min="0" value={addQty} onChange={e => { setAddQty(e.target.value); setErrors(prev => ({ ...prev, addQty: undefined })); }} />
          {errors.addQty && <div className="field-error">{errors.addQty}</div>}
        </div>
        <div className="form-group">
          <label>New Stock:</label>
          <input value={newStock} readOnly />
        </div>
        <div className="modal-buttons">
          <button onClick={handleConfirm}>Confirm</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      {/* Sidebar is centralized in Layout */}
      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <div className="logo-container">
            <img src={logo} alt="Sales Point Logo" className="logo" />
          </div>
          <input type="text" placeholder="Search items..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <div className="top-icons">John Doe Owner</div>
        </header>

        {loading && (
          <div className="inventory-loading">Loading inventory…</div>
        )}

        <section className="inventory-header">
          <h1>Inventory Management</h1>
          <button className="add-item-button" onClick={() => setShowAddModal(true)}>Add New Item</button>
        </section>
        <div className="table-controls">
          <div className="controls-left">
            <label className="control-label">Category:</label>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <div className="filter-chips">
              <button className={`chip ${stockFilters.low ? 'active' : ''}`} onClick={() => setStockFilters(s => ({ ...s, low: !s.low }))}>Low Stock</button>
              <button className={`chip ${stockFilters.out ? 'active' : ''}`} onClick={() => setStockFilters(s => ({ ...s, out: !s.out }))}>Out of Stock</button>
              <button className={`chip ${stockFilters.in ? 'active' : ''}`} onClick={() => setStockFilters(s => ({ ...s, in: !s.in }))}>In Stock</button>
            </div>
          </div>
        </div>

        <section className="inventory-table-container">
          <table className={`inventory-table ${animate ? 'table-fade' : ''}`}>
            <thead>
              <tr>
                <th className={`th-sortable ${sortBy === 'name' ? 'sorted' : ''}`} onClick={() => handleSort('name')}>Item {sortBy === 'name' && (sortDirection === 'asc' ? '▲' : (sortDirection === 'desc' ? '▼' : ''))}</th>
                <th className={`th-sortable ${sortBy === 'category' ? 'sorted' : ''}`} onClick={() => handleSort('category')}>Category {sortBy === 'category' && (sortDirection === 'asc' ? '▲' : (sortDirection === 'desc' ? '▼' : ''))}</th>
                <th className={`th-sortable ${sortBy === 'stock' ? 'sorted' : ''}`} onClick={() => handleSort('stock')}>Stock {sortBy === 'stock' && (sortDirection === 'asc' ? '▲' : (sortDirection === 'desc' ? '▼' : ''))}</th>
                <th className={`th-sortable ${sortBy === 'price' ? 'sorted' : ''}`} onClick={() => handleSort('price')}>Price {sortBy === 'price' && (sortDirection === 'asc' ? '▲' : (sortDirection === 'desc' ? '▼' : ''))}</th>
                <th className={`th-sortable ${sortBy === 'overall' ? 'sorted' : ''}`} onClick={() => handleSort('overall')}>Overall Cost {sortBy === 'overall' && (sortDirection === 'asc' ? '▲' : (sortDirection === 'desc' ? '▼' : ''))}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map(item => (
                <tr key={item._id || item.id}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.stock}</td>
                  <td>₱{item.price}</td>
                  <td>₱{calculateOverallCost(item.stock, item.price)}</td>
                  <td>
                    <button className="icon-btn" title="Edit Item" onClick={() => setEditingItem(item)}>✏️</button>
                    <button className="icon-btn" title="Restock Item" onClick={() => setRestockItem(item)}>📦</button>
                    <button className="icon-btn delete" title="Delete Item" onClick={() => setDeletingItem(item)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Modals */}
        {showAddModal && (
          <div className="inventory-modal-overlay">
            <div className="inventory-modal-content">
              <h2>Add New Item</h2>
              <form onSubmit={handleAddItem}>
                <div className="form-group">
                  <label>Name:</label>
                  <input type="text" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Category:</label>
                  <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Stock:</label>
                  <input type="number" min="0" value={newItem.stock} onChange={e => { setNewItem({ ...newItem, stock: Number(e.target.value) }); setAddErrors(prev => ({ ...prev, stock: undefined })); }} required />
                  {addErrors.stock && <div className="field-error">{addErrors.stock}</div>}
                </div>
                <div className="form-group">
                  <label>Price:</label>
                  <input type="number" min="0" step="0.01" value={newItem.price} onChange={e => { setNewItem({ ...newItem, price: Number(e.target.value) }); setAddErrors(prev => ({ ...prev, price: undefined })); }} required />
                  {addErrors.price && <div className="field-error">{addErrors.price}</div>}
                </div>
                <div className="modal-buttons">
                  <button type="submit">Add</button>
                  <button type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingItem && (
          <div className="inventory-modal-overlay">
            <div className="inventory-modal-content">
              <h2>Edit Item</h2>
              <EditItemForm item={editingItem} categories={categories} onSave={handleUpdateItem} onCancel={() => setEditingItem(null)} />
            </div>
          </div>
        )}

        {restockItem && (
          <div className="inventory-modal-overlay">
            <div className="inventory-modal-content">
              <h2>Restock Item</h2>
              <RestockForm item={restockItem} onConfirm={(added) => confirmRestock(restockItem._id || restockItem.id, added)} onCancel={() => setRestockItem(null)} />
            </div>
          </div>
        )}

        {deletingItem && (
          <div className="inventory-modal-overlay">
            <div className="inventory-modal-content">
              <h3>Confirm Delete</h3>
              <p>Are you sure you want to delete <strong>{deletingItem.name}</strong>?</p>
              <div className="modal-buttons">
                <button onClick={() => confirmDelete(deletingItem._id || deletingItem.id)} className="modal-delete">Delete</button>
                <button onClick={() => setDeletingItem(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default Inventory;
