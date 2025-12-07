import mongoose from 'mongoose';

const ItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  price: { type: Number, required: true }
}, { _id: false });

const OrderRecordSchema = new mongoose.Schema({
  items: { type: [ItemSchema], required: true },
  total: { type: Number, required: true },
  paymentMethod: { type: String },
  createdAt: { type: Date, default: Date.now }
  ,storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' }
});

export default mongoose.model('OrderRecord', OrderRecordSchema);

