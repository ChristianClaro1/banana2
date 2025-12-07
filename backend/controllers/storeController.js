import mongoose from "mongoose";
import Store from "../models/Store.js";

export const joinStore = async (req, res) => {
  const { storeCode, email, role } = req.body;

  try {
    let store;

    // If it's a valid ObjectId, try by _id
    if (mongoose.Types.ObjectId.isValid(storeCode)) {
      store = await Store.findById(storeCode);
    }

    // Otherwise, try by joinCode
    if (!store) {
      store = await Store.findOne({ joinCode: storeCode });
    }

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    // Add member if not already present
    const alreadyMember = store.members.some(m => m.email === email);
    if (!alreadyMember) {
      store.members.push({ email, role });
      await store.save();
    }

    res.json({ storeName: store.name, storeId: store._id });
  } catch (err) {
    res.status(500).json({ error: "Server error: " + err.message });
  }
};