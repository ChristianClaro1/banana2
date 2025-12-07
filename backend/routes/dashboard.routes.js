// backend/routes/dashboard.routes.js
import express from "express";
import { getDashboardData } from "../controllers/dashboardController.js";

const router = express.Router();

// GET /api/dashboard
router.get("/", getDashboardData);

export default router;
