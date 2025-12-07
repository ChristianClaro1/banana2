import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Auth from "./pages/AuthPage";
import OrderPage from "./pages/OrderPage";
import Inventory from "./pages/InventoryPage";
import Dashboard from "./pages/Dashboard";
import ShiftSchedule from "./pages/ShiftPage";
import AuditLogsPage from "./pages/AuditPage";
import Roles from "./pages/RolesPage";
import SettingsPage from "./pages/SettingsPage";

import CreateStore from "./pages/CreateStore";
import LandingPage from "./pages/LandingPage";
import JoinStore from "./pages/JoinStore";
import MyStores from "./pages/MyStores";

import Sidebar from "./Layout/Sidebar";

import "./App.css";

function App() {
  console.log("Rendering App");

  return (
    <Router>
      <Routes>
        {/* Landing page (no sidebar) */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth pages (no sidebar) */}
        <Route path="/login" element={<Auth />} />
        <Route path="/signup" element={<Auth />} />

        {/* Pages WITH sidebar */}
        <Route path="/app" element={<Sidebar />}>
          {/* ✅ Only store-specific dashboard */}
          <Route path="dashboard/:storeId" element={<Dashboard />} />
          <Route path="order" element={<OrderPage />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="shift" element={<ShiftSchedule />} />
          <Route path="audit" element={<AuditLogsPage />} />
          <Route path="roles" element={<Roles />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Pages WITHOUT sidebar */}
        <Route path="/createstore" element={<CreateStore />} />
        <Route path="/joinstore" element={<JoinStore />} />
        <Route path="/mystores" element={<MyStores />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;