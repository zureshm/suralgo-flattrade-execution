const logger = require("../utils/logger");

// Track recent orders to prevent accidental duplicates
// Key: "symbol-side" → timestamp of last order
const recentOrders = {};
const DUPLICATE_WINDOW_MS = 5000; // 5 seconds

function validatePlaceOrder({ symbol, qty, side, orderType, productType }) {
  const errors = [];

  // Symbol
  if (!symbol || typeof symbol !== "string" || symbol.trim().length === 0) {
    errors.push("symbol is required");
  }

  // Quantity
  if (qty === undefined || qty === null) {
    errors.push("qty is required");
  } else if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) {
    errors.push("qty must be a positive number");
  }

  // Side
  const validSides = ["BUY", "SELL"];
  if (!side || !validSides.includes((side || "").toUpperCase())) {
    errors.push("side must be BUY or SELL");
  }

  // Order type
  const validOrderTypes = ["MARKET", "LIMIT", "SL-LMT", "SL-MKT", "SL", "SLM"];
  if (orderType && !validOrderTypes.includes((orderType || "").toUpperCase())) {
    errors.push("orderType must be one of: " + validOrderTypes.join(", "));
  }

  // Product type
  const validProductTypes = ["INTRADAY", "NRML", "CNC", "MIS", "I", "M", "C"];
  if (productType && !validProductTypes.includes((productType || "").toUpperCase())) {
    errors.push("productType must be one of: " + validProductTypes.join(", "));
  }

  // Duplicate check
  if (symbol && side) {
    const key = `${symbol}-${(side || "").toUpperCase()}`;
    const lastTime = recentOrders[key];
    const now = Date.now();

    if (lastTime && now - lastTime < DUPLICATE_WINDOW_MS) {
      errors.push(
        `Duplicate order detected — same symbol+side within ${DUPLICATE_WINDOW_MS / 1000}s. Wait or confirm.`
      );
    }
  }

  if (errors.length > 0) {
    logger.warn("Order validation failed", { symbol, qty, side, errors });
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

function validateExitOrder({ symbol, qty }) {
  const errors = [];

  if (!symbol || typeof symbol !== "string" || symbol.trim().length === 0) {
    errors.push("symbol is required");
  }

  if (qty === undefined || qty === null) {
    errors.push("qty is required");
  } else if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) {
    errors.push("qty must be a positive number");
  }

  if (errors.length > 0) {
    logger.warn("Exit validation failed", { symbol, qty, errors });
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

function validateCancelOrder({ orderId }) {
  const errors = [];

  if (!orderId || typeof orderId !== "string" || orderId.trim().length === 0) {
    errors.push("orderId is required");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

// Record that an order was placed (call after successful placement)
function recordOrder(symbol, side) {
  const key = `${symbol}-${(side || "").toUpperCase()}`;
  recentOrders[key] = Date.now();
}

module.exports = {
  validatePlaceOrder,
  validateExitOrder,
  validateCancelOrder,
  recordOrder,
};
