import express from "express";
import mongoose from "mongoose";
import Store from "../models/Store.js";

const router = express.Router();

// ✅ Create Store
router.post("/", async (req, res) => {
  try {
    const { ownerEmail, name, owner, phone, address, currency, tax, logo } = req.body;

    // Validate required fields
    if (!ownerEmail || !name || !owner) {
      return res.status(400).json({ error: "Missing required fields: ownerEmail, name, or owner" });
    }

    const store = new Store({ ownerEmail, name, owner, phone, address, currency, tax, logo });
    await store.save();

    res.status(201).json(store);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Join Store (accepts both ObjectId and joinCode)
router.post("/join", async (req, res) => {
  const { storeCode, email, role } = req.body;
  try {
    let store;

    // If it's a valid ObjectId, try by _id
    if (mongoose.Types.ObjectId.isValid(storeCode)) {
      store = await Store.findById(storeCode);
    }

    // Otherwise, try by joinCode (if implemented in schema)
    if (!store) {
      store = await Store.findOne({ joinCode: storeCode });
    }

    if (!store) return res.status(404).json({ error: "Store not found" });

    // Check if already a member
    const exists = store.members.find((m) => m.email === email);
    if (exists) return res.status(400).json({ error: "Already joined" });

    store.members.push({ email, role });
    await store.save();

    // ✅ Return storeId so frontend can redirect to dashboard
    res.json({
      message: "Joined successfully",
      storeName: store.name,
      storeId: store._id.toString() // ensure it's a string for frontend
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ My Stores (created or joined)
router.get("/mystores", async (req, res) => {
  const { email } = req.query; // pass user email in query
  try {
    // Stores created by this user (ownerEmail)
    const createdStores = await Store.find({ ownerEmail: email });

    // Stores joined by this user (member email)
    const joinedStores = await Store.find({ "members.email": email });

    // Merge results (avoid duplicates if user is both owner & member)
    const allStores = [...createdStores, ...joinedStores].filter(
      (store, index, self) =>
        index === self.findIndex((s) => s._id.toString() === store._id.toString())
    );

    res.json(allStores);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Leave Store
router.post("/:id/leave", async (req, res) => {
  const { email } = req.body;
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: "Store not found" });

    store.members = store.members.filter((m) => m.email !== email);
    await store.save();

    res.json({ message: "Left store successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Delete Store (only owner should be allowed)
router.delete("/:id", async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: "Store not found" });

    // Optional: verify owner before delete
    // const { email } = req.body;
    // if (store.ownerEmail !== email) {
    //   return res.status(403).json({ error: "Only owner can delete store" });
    // }

    await Store.findByIdAndDelete(req.params.id);
    res.json({ message: "Store deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;