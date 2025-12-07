// backend/models/Sales.js
import mongoose from "mongoose";

const SalesSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  total: { type: Number, required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' }
});

export default mongoose.model("Sales", SalesSchema);
