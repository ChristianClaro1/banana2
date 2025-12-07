// backend/models/Role.js
import mongoose from "mongoose";

const PHONE_REGEX = /^[0-9]{10,13}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const RoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, match: EMAIL_REGEX },
    role: { type: String, required: true, enum: ['Owner','Admin','Manager','Staff'] },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    hiringDate: { type: Date, required: true, default: Date.now },
    phone: { type: String, required: true, match: PHONE_REGEX },
    status: { type: String, enum: ['active','suspended'], default: 'active' },
    is_deleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Index commonly queried fields
RoleSchema.index({ email: 1, storeId: 1 });

export default mongoose.model("Role", RoleSchema);
