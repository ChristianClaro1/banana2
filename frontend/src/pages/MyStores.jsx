import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../pages-css/mystores.css";
import logo from "../assets/salespoint-logo.png";

function MyStores() {
  const [stores, setStores] = useState([]);
  const email = localStorage.getItem("userEmail") || "";
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/stores/mystores?email=${email}`);
        if (!res.ok) throw new Error("Failed to fetch stores");
        const data = await res.json();

        // ✅ Restrict access: only staff or owner can continue
        if (!data || data.length === 0) {
          alert("Access denied. You are not a staff or owner of any store.");
          navigate("/"); // back to landing page
          return;
        }

        setStores(data);
      } catch (err) {
        console.error("Error fetching stores:", err);
      }
    };

    if (email) fetchStores();
    else {
      // If no email in localStorage, force login
      navigate("/login");
    }
  }, [email, navigate]);

  const handleLeave = async (storeId) => {
    if (!window.confirm("Are you sure you want to leave this store?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/stores/${storeId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to leave the store");

      setStores((prevStores) => prevStores.filter((s) => s._id !== storeId));
    } catch (err) {
      console.error("Error leaving store:", err);
      alert("Failed to leave the store. Please try again.");
    }
  };

  const handleDelete = async (storeId) => {
    if (!window.confirm("⚠️ Are you sure you want to delete this store? This action cannot be undone.")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/stores/${storeId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }), // send email for owner verification
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete the store");

      setStores((prevStores) => prevStores.filter((s) => s._id !== storeId));
    } catch (err) {
      console.error("Error deleting store:", err);
      alert("Failed to delete the store. Please try again.");
    }
  };

  const handleDashboard = (storeId) => {
    localStorage.setItem("currentStoreId", storeId);
    navigate(`/app/dashboard/${storeId}`);
  };

  return (
    <div className="landing-container">
      <div className="landing-logo">
        <img src={logo} alt="SalesPoint Logo" className="logo" />
      </div>
      <div className="landing-header">
        <h1>My Stores</h1>
        <p>View and manage the stores you created or joined.</p>
      </div>
      <div className="landing-options">
        {stores.length > 0 ? (
          <table className="stores-table">
            <thead>
              <tr>
                <th>Store Name</th>
                <th>Owner</th>
                <th>Owner Email</th>
                <th>Role</th>
                <th>Date Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => {
                const role = store.members.find((m) => m.email === email)?.role || "Owner";
                return (
                  <tr key={store._id}>
                    <td>{store.name}</td>
                    <td>{store.owner}</td>
                    <td>{store.ownerEmail}</td>
                    <td>{role}</td>
                    <td>{new Date(store.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="dashboard-btn"
                        onClick={() => handleDashboard(store._id)}
                      >
                        Dashboard
                      </button>
                      {store.ownerEmail === email ? (
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(store._id)}
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          className="leave-btn"
                          onClick={() => handleLeave(store._id)}
                        >
                          Leave
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ textAlign: "center", padding: "20px" }}>No stores found.</p>
        )}
      </div>
    </div>
  );
}

export default MyStores;