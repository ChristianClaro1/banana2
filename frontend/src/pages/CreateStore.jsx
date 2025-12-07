import React, { useState } from "react";
import "../pages-css/createstore.css";
import logo from "../assets/salespoint-logo.png";
import { useNavigate } from "react-router-dom";

function CreateStore() {
  const [storeData, setStoreData] = useState({
    name: "",
    owner: "",
    email: "",
    phone: "",
    address: "",
    currency: "₱",
    tax: "",
    logo: null,
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStoreData({ ...storeData, [name]: value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setStoreData({ ...storeData, logo: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...storeData,
        ownerEmail: storeData.email,
        members: [{ email: storeData.email, role: "Creator" }],
      };
      delete payload.email;

      const res = await fetch("http://localhost:5000/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const created = await res.json();

      if (res.ok) {
        alert(`Store "${created.name}" created successfully!\nStore ID: ${created._id}`);

        // Save user email and store ID for later use
        localStorage.setItem("userEmail", storeData.email);
        localStorage.setItem("currentStoreId", created._id);

        // Redirect to store-specific dashboard WITH sidebar
        navigate(`/app/dashboard/${created._id}`);
      } else {
        alert(created.error || "Failed to create store.");
      }
    } catch (err) {
      console.error("Error creating store:", err);
      alert("Server error. Please try again later.");
    }
  };

  const handleBack = () => {
    navigate("/"); // back to landing page
  };

  return (
    <div className="landing-container">
      <div className="landing-logo">
        <img src={logo} alt="SalesPoint Logo" className="logo" />
      </div>

      <div className="landing-header">
        <h1>Create Your Store</h1>
        <p>Fill in the details below to start a new store.</p>
      </div>

      <div className="landing-options">
        <form className="store-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            value={storeData.name}
            onChange={handleChange}
            placeholder="Store Name"
            required
          />
          <input
            type="text"
            name="owner"
            value={storeData.owner}
            onChange={handleChange}
            placeholder="Owner Name"
            required
          />
          <input
            type="email"
            name="email"
            value={storeData.email}
            onChange={handleChange}
            placeholder="Owner Email"
            required
          />
          <input
            type="text"
            name="phone"
            value={storeData.phone}
            onChange={handleChange}
            placeholder="Phone Number"
          />
          <input
            type="text"
            name="address"
            value={storeData.address}
            onChange={handleChange}
            placeholder="Address"
          />
          <select name="currency" value={storeData.currency} onChange={handleChange}>
            <option value="₱">Philippine Peso (₱)</option>
            <option value="$">US Dollar ($)</option>
            <option value="€">Euro (€)</option>
          </select>
          <input
            type="number"
            name="tax"
            value={storeData.tax}
            onChange={handleChange}
            placeholder="Tax/VAT %"
          />
          <input type="file" name="logo" onChange={handleFileChange} />

          <div className="form-buttons">
            <button type="submit">Create Store</button>
            <button type="button" onClick={handleBack} className="back-btn">
              Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateStore;