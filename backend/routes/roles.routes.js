// backend/routes/roles.routes.js
import { Router } from "express";
import { getRoles, createRole, updateRole, deleteRole } from "../controllers/roles.controller.js";

const router = Router();

router.get("/", getRoles);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
