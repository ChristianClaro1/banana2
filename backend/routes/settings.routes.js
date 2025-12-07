import express from "express";
import { getSettings, updateSetting } from "../controllers/settings.controller.js";

const router = express.Router();

// GET all settings
router.get("/", getSettings);

// POST/PUT single setting
router.post("/", updateSetting);

export default router;
