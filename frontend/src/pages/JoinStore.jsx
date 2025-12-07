import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../pages-css/joinstore.css";
import logo from "../assets/salespoint-logo.png";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

function JoinStore() {
  const [formData, setFormData] = useState({
    storeCode: "",
    email: "",
    role: "Staff",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        storeCode: formData.storeCode.trim(),
        email: formData.email.trim() || userEmail,
        role: formData.role,
      };

      const res = await fetch(`/api/stores/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        setMessage(`✅ Successfully joined store: ${result.storeName}`);

        // Persist email globally so MyStores can fetch correctly
        localStorage.setItem("userEmail", payload.email);

        // Save current storeId for sidebar/dashboard navigation
        if (result.storeId) {
          localStorage.setItem("currentStoreId", result.storeId);
        }

        // Reset form
        setFormData({ storeCode: "", email: "", role: "Staff" });

        // ✅ Redirect directly to the store dashboard
        if (result.storeId) {
          window.location.href = `/app/dashboard/${result.storeId}`;
        } else {
          // fallback if storeId not returned
          window.location.href = "/mystores";
        }
      } else {
        setMessage(`❌ ${result.error || "Failed to join store."}`);
      }
    } catch (err) {
      console.error("Error joining store:", err);
      setMessage("⚠️ Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate("/"); // ✅ back to landing page
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && u.email) setUserEmail(u.email);
      else setUserEmail("");
    });
    return () => unsub();
  }, []);

  return (
    <div className="landing-container">
      {/* Centered Logo */}
      <div className="landing-logo">
        <img src={logo} alt="SalesPoint Logo" className="logo" />
      </div>

      {/* Page Header */}
      <div className="landing-header">
        <h1>Join a Store</h1>
        <p>Enter the store code to join an existing store.</p>
      </div>

      {/* Join Store Form */}
      <div className="landing-options">
        <form className="join-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="storeCode"
            value={formData.storeCode}
            onChange={handleChange}
            placeholder="Enter Store Code"
            required
          />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Your Email"
            required
          />
          <select name="role" value={formData.role} onChange={handleChange}>
            <option value="Staff">Staff</option>
            <option value="Manager">Manager</option>
          </select>

          <div className="form-buttons">
            <button type="submit" disabled={loading}>
              {loading ? "Joining..." : "Join Store"}
            </button>
            <button type="button" onClick={handleBack} className="back-btn">
              Back
            </button>
          </div>
        </form>

        {message && <p className="feedback">{message}</p>}
      </div>
    </div>
  );
}

export default JoinStore;