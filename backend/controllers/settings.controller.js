import Setting from "../models/Setting.js";

// Initialize default settings if not present
export const initializeSettings = async () => {
  const defaults = [
    { key: "userPin", value: "" },
    { key: "businessName", value: "My Store" },
    { key: "receiptFooter", value: "Thank you!" },
    { key: "taxRate1", value: 0 },
    { key: "taxRate2", value: 0 },
    { key: "storeName", value: "My Store" },
    { key: "storeAddress", value: "" },
    { key: "storeCurrency", value: "₱" },
    { key: "enableCashDrawer", value: false },
    { key: "cashPayments", value: 0 },
    { key: "cardPayments", value: 0 },
    { key: "mobilePayments", value: 0 },
    { key: "shiftMode", value: "tri-shift" },
  ];

  for (const def of defaults) {
    const exists = await Setting.findOne({ key: def.key });
    if (!exists) await new Setting(def).save();
  }

  console.log("Default settings initialized");
};

// GET all settings
export const getSettings = async (req, res) => {
  try {
    const settings = await Setting.find();
    res.status(200).json(settings);
  } catch (err) {
    res.status(500).json({ message: "Failed to load settings", error: err });
  }
};

// UPDATE or CREATE a setting
export const updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ message: "Key is required" });

    const updated = await Setting.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true }
    );

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update setting", error: err });
  }
};
