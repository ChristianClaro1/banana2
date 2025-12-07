import mongoose from "mongoose";

const InventorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  stock: { type: Number, required: true },
  price: { type: Number, required: true },
  variants: { type: [String], default: [] }
  ,storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' }
}, { timestamps: true });

export default mongoose.model("Inventory", InventorySchema);