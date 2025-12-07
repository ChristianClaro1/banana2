import mongoose from "mongoose";

const ShiftSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    type: { type: String, required: true },
    start: { type: String },
    end: { type: String },
    status: { type: String, default: "assigned" }
  },
  { timestamps: true }
);

export default mongoose.model("Shift", ShiftSchema);

