export const attachStore = (req, res, next) => {
  // Order of precedence: header x-store-id, query param storeId, body.storeId
  const storeId = req.header('x-store-id') || req.query.storeId || req.body?.storeId || null;
  req.storeId = storeId || null;
  next();
};

export const getStoreFilter = (req) => {
  return req.storeId ? { storeId: req.storeId } : {};
};
