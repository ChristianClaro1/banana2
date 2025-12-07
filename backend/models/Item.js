import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    variants: {
      type: [String],
      default: []
    }
  },
  { timestamps: true } // optional but useful
);

ItemSchema.add({ storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' } });

export default mongoose.model("Item", ItemSchema);
