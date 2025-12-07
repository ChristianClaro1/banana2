import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' }
  },
  { timestamps: true } // optional: createdAt and updatedAt
);

export default mongoose.model("Category", CategorySchema);
