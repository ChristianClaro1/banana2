import React, { useState, useEffect } from "react";
import API from "../api";
import "../pages-css/order.css";
import logo from "../assets/salespoint-logo.png";

// Use centralized `API` instance (baseURL `/api`) so `x-store-id` is attached automatically

export default function OrderPage() {
  const [categories, setCategories] = useState(["All"]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState("");

  const [showManageMenuModal, setShowManageMenuModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemVariants, setNewItemVariants] = useState("");
  // Toasts for modern alerts
  const [toasts, setToasts] = useState([]);
  const showToast = (type, message, timeout = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), timeout);
  };

  // Fetch categories and items from backend on load
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const catRes = await API.get(`/menu/categories`);
        if (!mounted) return;
        setCategories(["All", ...catRes.data.map(c => c.name)]);

        const [itemRes, invRes] = await Promise.all([
          API.get(`/menu/items`),
          API.get(`/inventory`)
        ]);
        if (!mounted) return;

        // Inventory items may have stock/variants; map them to the same shape used by menu
        const invItems = (invRes.data || []).map(i => ({
          _id: i._id,
          name: i.name,
          price: i.price,
          category: i.category,
          variants: i.variants && i.variants.length ? i.variants : undefined,
          stock: i.stock,
          source: 'inventory'
        }));

        const menuItems = (itemRes.data || []).map(i => ({ ...i, source: 'menu' }));

        // Merge menu + inventory, inventory appended (but avoid id collisions)
        const merged = [...menuItems, ...invItems.filter(inv => !menuItems.some(m => String(m._id) === String(inv._id)))];
        setItems(merged);
      } catch (err) {
        console.error(err);
        showToast('error', "Failed to fetch menu/inventory data");
      }
    };
    fetchData();

    // Poll inventory periodically so newly added inventory items show up in order page
    const poll = setInterval(() => fetchData(), 5000);
    return () => { mounted = false; clearInterval(poll); };
  }, []);

  const filteredItems =
    selectedCategory === "All"
      ? items
      : items.filter(item => item.category === selectedCategory);

  const openItemModal = (item) => {
    setSelectedItem(item);
    setSelectedVariant(item.variants ? item.variants[0] : "");
    setShowItemModal(true);
  };

  const addToCart = () => {
    if (!selectedItem) return;
    const itemKey = selectedItem._id + (selectedVariant || "");

    // Check stock if available
    const stock = typeof selectedItem.stock !== 'undefined' ? Number(selectedItem.stock) : null;
    const existingQty = (cart.find(i => i.key === itemKey)?.qty) || 0;
    if (stock !== null && existingQty + 1 > stock) {
      showToast('warn', 'Cannot add more — item out of stock');
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.key === itemKey);
      if (existing) {
        return prev.map(i => i.key === itemKey ? { ...i, qty: i.qty + 1 } : i);
      }
      return [
        ...prev,
        {
          key: itemKey,
          id: selectedItem._id,
          name: selectedItem.name,
          price: selectedItem.price,
          variant: selectedVariant,
          qty: 1,
        },
      ];
    });

    setShowItemModal(false);
  };

  const updateQty = (key, delta) => {
    // adjust by delta using setQty which enforces stock
    setCart(prev => {
      const existing = prev.find(i => i.key === key);
      const current = existing ? existing.qty : 0;
      const newQty = current + delta;
      // use setQty logic inline to avoid stale closures
      if (newQty <= 0) {
        return prev.filter(i => i.key !== key);
      }
      const itemDef = items.find(it => String(it._id) === String(existing?.id));
      if (itemDef && typeof itemDef.stock !== 'undefined' && newQty > Number(itemDef.stock)) {
        showToast('warn', 'Not enough stock');
        return prev;
      }
      return prev.map(i => i.key === key ? { ...i, qty: newQty } : i);
    });
  };

  const setQty = (key, qty) => {
    const newQty = Number(qty) || 0;
    setCart(prev => {
      const existing = prev.find(i => i.key === key);
      if (!existing) return prev;
      if (newQty <= 0) {
        // remove item
        return prev.filter(i => i.key !== key);
      }
      const itemDef = items.find(it => String(it._id) === String(existing.id));
      if (itemDef && typeof itemDef.stock !== 'undefined' && newQty > Number(itemDef.stock)) {
        showToast('warn', `Cannot set quantity. Only ${itemDef.stock} left`);
        return prev;
      }
      return prev.map(i => i.key === key ? { ...i, qty: newQty } : i);
    });
  };

  // Remove cart entries if underlying item was deleted from menu/inventory
  useEffect(() => {
    setCart(prev => prev.filter(ci => items.some(it => String(it._id) === String(ci.id))));
  }, [items]);

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  const removeCartItem = (key) => {
    setCart(prev => {
      const existing = prev.find(i => i.key === key);
      if (!existing) return prev;
      showToast('warn', `${existing.name} removed from cart`);
      return prev.filter(i => i.key !== key);
    });
  };

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const finalTotal = Math.max(total - discount, 0);

  // Place order: decrement inventory stocks for inventory items, enforce limits
  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      showToast('warn', 'Cart is empty');
      return;
    }
    // First, validate stock availability again
    for (const ci of cart) {
      const itemDef = items.find(it => String(it._id) === String(ci.id));
      if (!itemDef) {
        showToast('error', `Item ${ci.name} no longer exists`);
        return;
      }
      if (typeof itemDef.stock !== 'undefined') {
        const available = Number(itemDef.stock);
        if (ci.qty > available) {
          showToast('warn', `Not enough stock for ${ci.name}. Available: ${available}`);
          return;
        }
      }
    }

    // Send the whole order to the backend so it can atomically decrement stocks and write Subtracted audit logs
    try {
      const payload = {
        items: cart.map(ci => ({ id: ci.id, name: ci.name, qty: ci.qty, price: ci.price })),
        paymentMethod,
        discount,
        // include user info if available; replace with real user email/role when auth is added
        userEmail: 'owner@example.local',
        userRole: 'Owner'
      };
      const resp = await API.post('/orders', payload);
      const { orderId, updatedItems: returned } = resp.data;

      // Merge updated inventory stocks into local items
      setItems(prev => prev.map(it => {
        const updated = returned.find(u => String(u.id || u._id) === String(it._id) || String(u.id) === String(it._id));
        if (updated) return { ...it, stock: updated.stock };
        return it;
      }));

      clearCart();
      showToast('success', `Order placed (${orderId})`);
      // Dispatch a window event so dashboard (and other listeners) can update immediately
      try {
        const qty = cart.reduce((s, i) => s + i.qty, 0);
        const itemName = cart.length === 1 ? cart[0].name : `${cart.length} items`;
        const createdAt = new Date().toISOString();
        const evt = new CustomEvent('order:created', { detail: { _id: orderId, itemName, quantity: qty, totalAmount: finalTotal, paymentMethod, createdAt, customerId: null } });
        window.dispatchEvent(evt);
      } catch (e) {
        // non-fatal
      }
    } catch (err) {
      console.error('Failed to place order', err);
      showToast('error', 'Failed to place order. Please try again.');
      // refresh items from server to get authoritative state
      try {
        const [itemRes, invRes] = await Promise.all([
          API.get(`/menu/items`),
          API.get(`/inventory`)
        ]);
        const invItems = (invRes.data || []).map(i => ({
          _id: i._id,
          name: i.name,
          price: i.price,
          category: i.category,
          variants: i.variants && i.variants.length ? i.variants : undefined,
          stock: i.stock,
          source: 'inventory'
        }));
        const menuItems = (itemRes.data || []).map(i => ({ ...i, source: 'menu' }));
        const merged = [...menuItems, ...invItems.filter(inv => !menuItems.some(m => String(m._id) === String(inv._id)))];
        setItems(merged);
      } catch (e) {
        console.error('Failed to refresh items', e);
      }
    }
  };

  /* -------------------------
     CATEGORY FUNCTIONS
  ------------------------- */
  const addCategory = async () => {
    if (!newCategoryName.trim() || categories.includes(newCategoryName)) return;

    try {
      const res = await API.post(`/menu/categories`, { name: newCategoryName });
      setCategories([...categories, res.data.name]);
      setNewCategoryName("");
    } catch (err) {
      console.error(err);
      showToast('error', err.response?.data?.message || "Failed to add category");
    }
  };

  const deleteCategory = async (cat) => {
    if (cat === "All") return;
    if (!window.confirm(`Delete category "${cat}"? Items in this category will also be deleted.`)) return;

    try {
      await API.delete(`/menu/categories/${cat}`);
      setCategories(categories.filter(c => c !== cat));
      setItems(items.filter(i => i.category !== cat));
      if (selectedCategory === cat) setSelectedCategory("All");
    } catch (err) {
      console.error(err);
      showToast('error', "Failed to delete category");
    }
  };

  /* -------------------------
     ITEM FUNCTIONS
  ------------------------- */
  const addItem = async () => {
    if (!newItemName.trim() || !newItemPrice || !newItemCategory) return;

    const variantsArray = newItemVariants
      ? newItemVariants.split(",").map(v => v.trim())
      : [];

    const newItemData = {
      name: newItemName,
      price: parseFloat(newItemPrice),
      category: newItemCategory,
      variants: variantsArray.length ? variantsArray : undefined,
    };

    try {
      const res = await API.post(`/menu/items`, newItemData);
      setItems([...items, res.data]);
      setNewItemName("");
      setNewItemPrice("");
      setNewItemCategory(categories[1] || "");
      setNewItemVariants("");
    } catch (err) {
      console.error(err);
      showToast('error', "Failed to add item");
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await API.delete(`/menu/items/${id}`);
      setItems(items.filter(i => i._id !== id));
    } catch (err) {
      console.error(err);
      showToast('error', "Failed to delete item");
    }
  };

  return (
    <div className="pos-container-modern">
      {/* LEFT PANEL */}
      <div className="left-panel-modern">
        <div className="top-bar-modern">
          <div className="logo-container-modern">
            <img src={logo} alt="Logo" className="logo-modern" />
          </div>
          <input type="text" placeholder="Search..." />
          <div className="user-profile-modern">John Doe • Owner</div>
        </div>

        <div className="category-tabs-modern">
          {categories.map(cat => (
            <button
              key={cat}
              className={cat === selectedCategory ? "active" : ""}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="item-grid-modern">
          {filteredItems.map(item => {
            const outOfStock = typeof item.stock !== 'undefined' && Number(item.stock) <= 0;
            return (
              <div
                key={item._id}
                className={`item-card-modern ${outOfStock ? 'out-of-stock' : ''}`}
                onClick={() => !outOfStock && openItemModal(item)}
                title={outOfStock ? 'Out of stock' : ''}
                style={{ opacity: outOfStock ? 0.5 : 1 }}
              >
                <div className="item-name-modern">{item.name}</div>
                <div className="item-price-modern">₱{item.price}{item.stock !== undefined ? ` • ${item.stock} left` : ''}</div>
                {outOfStock && <div className="oos-badge">Out of Stock</div>}
              </div>
            );
          })}
        </div>

        <button
          className="add-item-btn-modern"
          onClick={() => setShowManageMenuModal(true)}
        >
          +
        </button>
      </div>

      {/* RIGHT PANEL — CART */}
      <div className="right-panel-modern">
        <div className="cart-header-modern">
          <div className="cart-title-modern">Order Summary</div>
          <div className="cart-count-modern">{cart.length} item{cart.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="cart-content-modern">
          {cart.length === 0 ? (
            <div className="empty-cart-modern">No items added</div>
          ) : (
            <ul className="cart-list-modern">
              {cart.map(item => (
                <li key={item.key} className="cart-item-modern">
                  <div className="cart-item-top">
                    <div className="cart-item-name">
                      {item.name}{" "}
                      {item.variant && <span className="variant-tag-modern">{item.variant}</span>}
                    </div>
                    <div className="cart-subtotal-modern">₱{item.price * item.qty}</div>
                  </div>
                  <div className="qty-controls-modern">
                    <div className="qty-left-controls">
                      <button onClick={() => updateQty(item.key, -1)}>-</button>
                      <input
                        type="number"
                        min={1}
                        className="qty-input-modern"
                        value={item.qty}
                        onChange={(e) => setQty(item.key, e.target.value)}
                      />
                      <button onClick={() => updateQty(item.key, 1)}>+</button>
                    </div>
                    <div className="qty-right-controls">
                      <button aria-label={`Remove ${item.name}`} className="delete-cart-item-modern" onClick={() => removeCartItem(item.key)} title="Remove item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <path d="M3 6h18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 11v6M14 11v6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="sr-only">Remove</span>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cart-footer-modern">
          <div className="discount-section-modern">
            <label>Discount</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
          </div>
          <div className="total-section-modern">Total: ₱{finalTotal}</div>

          <div className="payment-methods-modern">
            <label>Payment Method</label>
            <div className="payment-buttons-modern">
              {["GCash", "Cash", "Card"].map(m => (
                <button
                  key={m}
                  className={paymentMethod === m ? "selected" : ""}
                  onClick={() => setPaymentMethod(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="action-buttons-modern">
            <button className="primary" onClick={async () => {
              await handlePlaceOrder();
            }}>
              Place Order
            </button>
            <button onClick={clearCart} className="secondary">
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* ITEM MODAL */}
      {showItemModal && selectedItem && (
        <div className="modal-modern">
          <div className="modal-content-modern">
            <h3>{selectedItem.name}</h3>
            <p>₱{selectedItem.price}</p>

            {selectedItem.variants && (
              <select value={selectedVariant} onChange={(e) => setSelectedVariant(e.target.value)}>
                {selectedItem.variants.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}

            <button onClick={addToCart} className="add-to-cart-btn-modern">Add to Cart</button>
            <button onClick={() => setShowItemModal(false)} className="cancel-btn-modern">Cancel</button>
          </div>
        </div>
      )}

      {/* MANAGE MENU MODAL */}
      {showManageMenuModal && (
        <div className="modal-modern">
          <div className="modal-content-modern large-modal-modern">
            <h2>Manage Menu</h2>

            <div className="manage-section-modern">
              <h3>Categories</h3>
              <div className="add-form-modern">
                <input
                  type="text"
                  placeholder="New Category Name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <button onClick={addCategory}>Add</button>
              </div>
              <ul>
                {categories.filter(c => c !== "All").map(cat => (
                  <li key={cat}>
                    {cat}
                    <button className="delete-btn-modern" onClick={() => deleteCategory(cat)}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="manage-section-modern">
              <h3>Items</h3>
              <div className="add-form-modern">
                <input
                  type="text"
                  placeholder="Item Name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                />
                <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)}>
                  {categories.filter(c => c !== "All").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Variants (comma separated)"
                  value={newItemVariants}
                  onChange={(e) => setNewItemVariants(e.target.value)}
                />
                <button onClick={addItem}>Add Item</button>
              </div>

              <ul>
                {items.map(item => (
                  <li key={item._id}>
                    {item.name} - ₱{item.price} ({item.category})
                    {item.variants && ` [${item.variants.join(", ")}]`}
                    <button className="delete-btn-modern" onClick={() => deleteItem(item._id)}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>

            <button onClick={() => setShowManageMenuModal(false)} className="close-modal-btn-modern">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Toast container rendered at root of file (keeps component self-contained)
