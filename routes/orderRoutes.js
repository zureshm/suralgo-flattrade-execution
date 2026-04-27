const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// POST /orders/place — Place a new order
router.post("/place", orderController.placeOrder);

// POST /orders/exit — Exit an existing position
router.post("/exit", orderController.exitOrder);

// POST /orders/cancel — Cancel a pending order
router.post("/cancel", orderController.cancelOrder);

// GET /orders/book — Get full order book
router.get("/book", orderController.getOrderBook);

// GET /orders/:orderId — Get single order status
router.get("/:orderId", orderController.getOrderStatus);

module.exports = router;
