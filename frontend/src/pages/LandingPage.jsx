import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../pages-css/LandingPage.css";
import logo from "../assets/salespoint-logo.png";

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    try { localStorage.removeItem('currentStore'); } catch (e) { /* ignore */ }
  }, []);

  return (
    <div className="landing-container">

      {/* Logo */}
      <div className="landing-logo">
        <img src={logo} alt="SalesPoint Logo" className="logo" />
      </div>

      {/* Header */}
      <div className="landing-header">
        <h1>Welcome to SalesPoint</h1>
        <p>Select an option to continue</p>
      </div>

      {/* Options */}
      <div className="landing-options">

        {/* Create Store */}
        <div className="landing-card" onClick={() => navigate("/createstore")}>
          <h3>Create Store</h3>
          <p>Start a new store and manage everything from scratch.</p>
        </div>

        {/* Join Store */}
        <div className="landing-card" onClick={() => navigate("/joinstore")}>
          <h3>Join Store</h3>
          <p>Join an existing store using a store code.</p>
        </div>

        {/* View Store → goes to AuthPage first */}
        <div className="landing-card" onClick={() => navigate("/login")}>
          <h3>View Store</h3>
          <p>View stores you created or joined.</p>
        </div>

      </div>
    </div>
  );
};

export default LandingPage;