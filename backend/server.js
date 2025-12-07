import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";

// Routes
import roleRoutes from "./routes/roles.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import shiftRoutes from "./routes/shift.routes.js";
import storeRoutes from "./routes/store.routes.js";   // ✅ Added store routes
import { attachStore } from "./middleware/store.middleware.js";

import { initializeSettings } from "./controllers/settings.controller.js";

dotenv.config();
const app = express();

// ✅ Middleware
app.use(cors());
// increase body size limits to accommodate larger payloads (e.g. bulk requests)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Attach store context (reads x-store-id header / query / body)
app.use(attachStore);

// ✅ Route registrations
app.use("/api/roles", roleRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/stores", storeRoutes);   // ✅ Register store routes

// ✅ Health check
app.get("/", (req, res) => res.send("POS API Running"));

// ✅ MongoDB connection
const MONGO_URI =
  process.env.MONGO_URI;

// Recent mongoose/mongodb drivers ignore these legacy options (they're no-ops)
// and will warn if provided. Connect without them.
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await initializeSettings(); // ensures defaults exist before any API call
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Global error handler for oversized payloads and other errors
app.use((err, req, res, next) => {
  // body-parser / express throws a PayloadTooLargeError with status 413
  if (!err) return next();
  const isPayloadTooLarge = err.status === 413 || err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError';
  if (isPayloadTooLarge) {
    console.warn('PayloadTooLargeError:', req.originalUrl, (req.headers['content-length'] || 'unknown') + ' bytes');
    return res.status(413).json({ error: 'Payload too large. Consider increasing server limits or using file upload endpoints.' });
  }
  // Fallback: log and forward
  console.error(err);
  return res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));