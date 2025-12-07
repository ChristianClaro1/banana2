import mongoose from "mongoose";

const ChangeSchema = new mongoose.Schema({
  field: { type: String, required: true },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const AuditLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  role: { type: String, required: true },

  // Structured fields
  actionType: { type: String, index: true },
  resourceType: { type: String, index: true },
  resourceId: { type: String, index: true },
  target: { type: String },
  changes: { type: [ChangeSchema], default: [] },
  meta: { type: mongoose.Schema.Types.Mixed },

  // Human-readable message (backwards compatibility)
  message: { type: String },
  // A concise summary field for UI display
  summary: { type: String },
  // Reference to an order if applicable
  orderId: { type: String, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },

  // Legacy field kept for compatibility
  action: { type: String },

  date: { type: Date, default: Date.now }
}, { timestamps: true });

// Index commonly queried fields
AuditLogSchema.index({ date: -1 });
AuditLogSchema.index({ actionType: 1, date: -1 });
AuditLogSchema.index({ email: 1, date: -1 });

export default mongoose.model("AuditLog", AuditLogSchema);