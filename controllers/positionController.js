const brokerService = require("../services/brokerService");
const logger = require("../utils/logger");

// GET /positions
async function getPositions(req, res) {
  try {
    const result = await brokerService.getPositions();
    res.json(result);
  } catch (error) {
    logger.error("Positions endpoint failed", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch positions: " + error.message,
    });
  }
}

// GET /trades
async function getTrades(req, res) {
  try {
    const result = await brokerService.getTradeBook();
    res.json(result);
  } catch (error) {
    logger.error("Trades endpoint failed", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch trade book: " + error.message,
    });
  }
}

module.exports = {
  getPositions,
  getTrades,
};
