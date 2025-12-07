// backend/initSettings.js
import Setting from "./models/Setting.js";

export const initializeSettings = async () => {
  const defaults = [
    { key: "userPin", value: "" },
    { key: "cashPayments", value: 0 },
    { key: "cardPayments", value: 0 },
    { key: "mobilePayments", value: 0 },
    { key: "businessName", value: "" },
    { key: "receiptFooter", value: "" },
    { key: "enableCashDrawer", value: false },
    { key: "enablePrinterReceipt", value: false }, // <-- add this line
    { key: "taxRate1", value: 0 },
    { key: "taxRate2", value: 0 },
    { key: "storeName", value: "" },
    { key: "storeAddress", value: "" },
    { key: "storeCurrency", value: "₱" },
  ];

  for (const setting of defaults) {
    await Setting.findOneAndUpdate(
      { key: setting.key },
      { value: setting.value },
      { upsert: true }
    );
  }

  console.log("Default settings initialized");
};
