const express = require("express");
const router = express.Router();
const positionController = require("../controllers/positionController");

// GET /positions — Get open positions
router.get("/", positionController.getPositions);

// GET /trades — Get trade book
router.get("/trades", positionController.getTrades);

module.exports = router;
