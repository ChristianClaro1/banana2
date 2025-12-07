import React, { useState, useEffect } from "react";
import API from "../api";
import "../pages-css/settings.css";
import logo from "../assets/salespoint-logo.png";

// use centralized API instance; interceptor attaches `x-store-id`

const SettingsPage = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await API.get(`/settings`);
        const obj = {};
        res.data.forEach((s) => (obj[s.key] = s.value));
        setSettings(obj);
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const saveSetting = async (key, value) => {
    try {
      setSaving(true);
      await API.post(`/settings`, { key, value });
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error("Failed to save setting:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="dashboard">
      <main className="main-content">
        <header className="top-bar">
          <div className="logo-container">
            <img src={logo} alt="Sales Point Logo" className="logo" />
          </div>
          <div className="user-profile">John Doe Owner</div>
        </header>

        <section className="settings-section">

          {/* User Accounts */}
          <div className="settings-card">
            <h3>User Accounts</h3>
            <input
              type="password"
              placeholder="Set Login PIN/Password"
              value={settings.userPin || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, userPin: e.target.value }))
              }
            />
            <button
              disabled={saving}
              onClick={() => saveSetting("userPin", settings.userPin)}
            >
              Save
            </button>
          </div>

          {/* Payment Summary */}
          <div className="settings-card">
            <h3>Payment Summary</h3>
            <p>Cash: {settings.cashPayments || 0}</p>
            <p>Card: {settings.cardPayments || 0}</p>
            <p>Mobile: {settings.mobilePayments || 0}</p>
          </div>

          {/* Receipt */}
          <div className="settings-card">
            <h3>Receipt</h3>
            <input
              type="text"
              placeholder="Business Name"
              value={settings.businessName || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, businessName: e.target.value }))
              }
            />
            <input
              type="text"
              placeholder="Receipt Footer"
              value={settings.receiptFooter || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, receiptFooter: e.target.value }))
              }
            />
            <button
              disabled={saving}
              onClick={async () => {
                await saveSetting("businessName", settings.businessName);
                await saveSetting("receiptFooter", settings.receiptFooter);
              }}
            >
              Save
            </button>
          </div>

          {/* Printer & Drawer */}
          <div className="settings-card">
            <h3>Printer & Drawer</h3>
            <label>
              <input
                type="checkbox"
                checked={settings.enableCashDrawer || false}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    enableCashDrawer: e.target.checked,
                  }))
                }
              />{" "}
              Enable Cash Drawer
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.enablePrinterReceipt || false}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    enablePrinterReceipt: e.target.checked,
                  }))
                }
              />{" "}
              Enable Printer Receipt
            </label>
            <button
              disabled={saving}
              onClick={async () => {
                await saveSetting("enableCashDrawer", settings.enableCashDrawer);
                await saveSetting(
                  "enablePrinterReceipt",
                  settings.enablePrinterReceipt
                );
              }}
            >
              Save
            </button>
          </div>

          {/* Tax */}
          <div className="settings-card">
            <h3>Tax</h3>
            <input
              type="number"
              placeholder="Tax Rate 1 (%)"
              value={settings.taxRate1 || 0}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, taxRate1: Number(e.target.value) }))
              }
            />
            <input
              type="number"
              placeholder="Tax Rate 2 (%)"
              value={settings.taxRate2 || 0}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, taxRate2: Number(e.target.value) }))
              }
            />
            <button
              disabled={saving}
              onClick={async () => {
                await saveSetting("taxRate1", settings.taxRate1);
                await saveSetting("taxRate2", settings.taxRate2);
              }}
            >
              Save
            </button>
          </div>

          {/* Store Info */}
          <div className="settings-card">
            <h3>Store Info</h3>
            <input
              type="text"
              placeholder="Store Name"
              value={settings.storeName || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, storeName: e.target.value }))
              }
            />
            <input
              type="text"
              placeholder="Address"
              value={settings.storeAddress || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, storeAddress: e.target.value }))
              }
            />
            <input
              type="text"
              placeholder="Currency"
              value={settings.storeCurrency || ""}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, storeCurrency: e.target.value }))
              }
            />
            <button
              disabled={saving}
              onClick={async () => {
                await saveSetting("storeName", settings.storeName);
                await saveSetting("storeAddress", settings.storeAddress);
                await saveSetting("storeCurrency", settings.storeCurrency);
              }}
            >
              Save
            </button>
          </div>

          {/* Shift Mode */}
          <div className="settings-card">
            <h3>Shift Mode</h3>
            <p>Choose how shifts rotate across trimesters/months.</p>
            <select
              value={settings.shiftMode || "tri-shift"}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, shiftMode: e.target.value }))
              }
            >
              <option value="tri-shift">Tri-Shift (Morning → Afternoon → Night)</option>
              <option value="dual-shift">Dual-Shift (Morning ↔ Afternoon)</option>
              <option value="single-shift">Single-Shift (No rotation)</option>
            </select>
            <div style={{ marginTop: 8 }}>
              <button disabled={saving} onClick={() => saveSetting("shiftMode", settings.shiftMode || "tri-shift")}>Save</button>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
};

export default SettingsPage;
