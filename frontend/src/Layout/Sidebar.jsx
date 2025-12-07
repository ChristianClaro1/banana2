import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import "./sidebar.css";

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  // ✅ Get current storeId from localStorage (set in CreateStore.jsx)
  const storeId = localStorage.getItem("currentStoreId");

  const isActive = (path) => location.pathname === path;

  const handleSignOut = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("currentStoreId");
    navigate("/"); // ✅ go to LandingPage
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${expanded ? "expanded" : "collapsed"}`}>
        <div className="sidebar-top">
          <div className="nav-toggle" onClick={() => setExpanded(!expanded)}>
            ☰
          </div>
          <Link to="/" className="logo" onClick={() => { try { localStorage.removeItem('currentStore'); } catch(e){/*ignore*/} }}>
            Sales Point
          </Link>
        </div>

        <nav className="sidebar-nav">
          <Link
            to={`/app/dashboard/${storeId}`}
            className={`nav-icon ${isActive(`/app/dashboard/${storeId}`) ? "active" : ""}`}
          >
            <span className="icon">🏠</span>
            {expanded && <span className="label">Dashboard</span>}
          </Link>

          <Link
            to="/app/roles"
            className={`nav-icon ${isActive("/app/roles") ? "active" : ""}`}
          >
            <span className="icon">👥</span>
            {expanded && <span className="label">Roles</span>}
          </Link>

          <Link
            to="/app/inventory"
            className={`nav-icon ${isActive("/app/inventory") ? "active" : ""}`}
          >
            <span className="icon">📦</span>
            {expanded && <span className="label">Inventory</span>}
          </Link>

          <Link
            to="/app/order"
            className={`nav-icon ${isActive("/app/order") ? "active" : ""}`}
          >
            <span className="icon">🧾</span>
            {expanded && <span className="label">Order Entries</span>}
          </Link>

          <Link
            to="/app/audit"
            className={`nav-icon ${isActive("/app/audit") ? "active" : ""}`}
          >
            <span className="icon">🕵️</span>
            {expanded && <span className="label">Audit Logs</span>}
          </Link>

          <Link
            to="/app/shift"
            className={`nav-icon ${isActive("/app/shift") ? "active" : ""}`}
          >
            <span className="icon">📅</span>
            {expanded && <span className="label">Shift Board</span>}
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <Link
            to="/app/settings"
            className={`nav-icon ${isActive("/app/settings") ? "active" : ""}`}
          >
            <span className="icon">⚙️</span>
            {expanded && <span className="label">Settings</span>}
          </Link>

          {/* ✅ Sign Out now goes to LandingPage */}
          <button onClick={handleSignOut} className="nav-icon">
            <span className="icon">🔓</span>
            {expanded && <span className="label">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Page Content */}
      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;