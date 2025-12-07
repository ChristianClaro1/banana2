import express from "express";
import {
  getCategories,
  addCategory,
  deleteCategory,
  getItems,
  addItem,
  deleteItem
} from "../controllers/menu.controller.js";

const router = express.Router();

/* ===========================
   CATEGORY ROUTES
=========================== */
router.get("/categories", getCategories);   // Get all categories
router.post("/categories", addCategory);    // Add a new category
router.delete("/categories/:name", deleteCategory); // Delete a category + items

/* ===========================
   ITEM ROUTES
=========================== */
router.get("/items", getItems);             // Get all items
router.post("/items", addItem);             // Add a new item
router.delete("/items/:id", deleteItem);    // Delete a specific item

export default router;
