import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    // Basic store info
    name: { type: String, required: true },          // Store name
    owner: { type: String, required: true },         // Owner full name
    ownerEmail: { type: String, required: true },    // Owner email (used in MyStores query)
    phone: { type: String },
    address: { type: String },
    currency: { type: String, default: "₱" },
    tax: { type: Number, default: 0 },
    logo: { type: String },                          // Store logo path or URL

    // Members who joined the store
    members: [
      {
        email: { type: String, required: true },
        role: { type: String, default: "Staff" },
        joinedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true } // ✅ adds createdAt and updatedAt automatically
);

// ✅ This model’s _id will be used as storeId in Products, Orders, and Sales
export default mongoose.model("Store", storeSchema);