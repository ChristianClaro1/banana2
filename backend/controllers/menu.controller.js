// backend/controllers/menu.controller.js

import Item from "../models/Item.js";
import Category from "../models/Category.js";
import { getStoreFilter } from "../middleware/store.middleware.js";

/* ===========================
   CATEGORY CONTROLLERS
=========================== */

// @desc   Get all categories
// @route  GET /api/menu/categories
export const getCategories = async (req, res) => {
  try {
    const filter = getStoreFilter(req);
    const categories = await Category.find(filter).sort({ name: 1 });
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Failed to load categories", error });
  }
};

// @desc   Add a new category
// @route  POST /api/menu/categories
export const addCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const filter = getStoreFilter(req);
    const exists = await Category.findOne({ ...filter, name: name.trim() });
    if (exists) {
      return res.status(400).json({ message: "Category already exists" });
    }
    const newCategory = new Category({ name: name.trim(), ...(req.storeId ? { storeId: req.storeId } : {}) });
    await newCategory.save();

    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Failed to add category", error });
  }
};

// @desc   Delete category and all items under it
// @route  DELETE /api/menu/categories/:name
export const deleteCategory = async (req, res) => {
  try {
    const { name } = req.params;

    if (!name) return res.status(400).json({ message: "Category name is required" });

    const filter = getStoreFilter(req);
    await Category.deleteOne({ ...filter, name });
    await Item.deleteMany({ ...filter, category: name });

    res.status(200).json({ message: `Category "${name}" and its items deleted` });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Failed to delete category", error });
  }
};

/* ===========================
   ITEM CONTROLLERS
=========================== */

// @desc   Get all menu items
// @route  GET /api/menu/items
export const getItems = async (req, res) => {
  try {
    const filter = getStoreFilter(req);
    const items = await Item.find(filter).sort({ name: 1 });
    res.status(200).json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ message: "Failed to load items", error });
  }
};

// @desc   Add a new menu item
// @route  POST /api/menu/items
export const addItem = async (req, res) => {
  try {
    const { name, price, category, variants } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ message: "Name, price, and category are required" });
    }

    const newItem = new Item({
      name: name.trim(),
      price,
      category: category.trim(),
      variants: variants?.length ? variants.map(v => v.trim()) : undefined,
      ...(req.storeId ? { storeId: req.storeId } : {})
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ message: "Failed to add item", error });
  }
};

// @desc   Delete a menu item
// @route  DELETE /api/menu/items/:id
export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: "Item ID is required" });

    // ensure we only delete items belonging to the current store (if provided)
    const filter = getStoreFilter(req);
    const deleted = await Item.findOneAndDelete({ _id: id, ...filter });
    if (!deleted) return res.status(404).json({ message: "Item not found" });

    res.status(200).json({ message: "Item deleted" });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ message: "Failed to delete item", error });
  }
};
