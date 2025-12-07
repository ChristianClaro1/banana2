import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  sold: { type: Number, default: 0 },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' }
});

export default mongoose.model("Product", productSchema);
