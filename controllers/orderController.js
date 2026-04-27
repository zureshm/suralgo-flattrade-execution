const brokerService = require("../services/brokerService");
const { validatePlaceOrder, validateExitOrder, validateCancelOrder, recordOrder } = require("../services/orderValidationService");
const logger = require("../utils/logger");

// POST /orders/place
async function placeOrder(req, res) {
  try {
    const { symbol, qty, side, orderType, productType, price, triggerPrice } = req.body;

    // Validate
    const validation = validatePlaceOrder({ symbol, qty, side, orderType, productType });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    // Place order via broker
    const result = await brokerService.placeOrder({
      symbol,
      qty: Number(qty),
      side: (side || "").toUpperCase(),
      orderType: (orderType || "MARKET").toUpperCase(),
      productType: (productType || "INTRADAY").toUpperCase(),
      price: price || "0",
      triggerPrice: triggerPrice || "0",
    });

    // Record for duplicate detection
    if (result.success) {
      recordOrder(symbol, side);
    }

    res.json(result);
  } catch (error) {
    logger.error("Place order endpoint failed", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Order placement failed: " + error.message,
    });
  }
}

// POST /orders/exit
async function exitOrder(req, res) {
  try {
    const { symbol, qty, side } = req.body;

    // Validate
    const validation = validateExitOrder({ symbol, qty });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    // Exit: if side not given, default to "BUY" (closing a BUY position by selling)
    const result = await brokerService.exitOrder({
      symbol,
      qty: Number(qty),
      side: (side || "BUY").toUpperCase(),
    });

    res.json(result);
  } catch (error) {
    logger.error("Exit order endpoint failed", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Exit order failed: " + error.message,
    });
  }
}

// POST /orders/cancel
async function cancelOrder(req, res) {
  try {
    const { orderId } = req.body;

    const validation = validateCancelOrder({ orderId });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const result = await brokerService.cancelOrder({ orderId });
    res.json(result);
  } catch (error) {
    logger.error("Cancel order endpoint failed", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Cancel order failed: " + error.message,
    });
  }
}

// GET /orders/book
async function getOrderBook(req, res) {
  try {
    const result = await brokerService.getOrderBook();
    res.json(result);
  } catch (error) {
    logger.error("Order book endpoint failed", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch order book: " + error.message,
    });
  }
}

// GET /orders/:orderId
async function getOrderStatus(req, res) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required",
      });
    }

    const result = await brokerService.getOrderStatus(orderId);
    res.json(result);
  } catch (error) {
    logger.error("Order status endpoint failed", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch order status: " + error.message,
    });
  }
}

module.exports = {
  placeOrder,
  exitOrder,
  cancelOrder,
  getOrderBook,
  getOrderStatus,
};
