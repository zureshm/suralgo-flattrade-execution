const brokerService = require("../services/brokerService");
const logger = require("../utils/logger");

// POST /auth/login
async function login(req, res) {
  try {
    const { userId, userToken, apiKey, apiSecret, requestCode } = req.body || {};

    const result = await brokerService.login({ userId, userToken, apiKey, apiSecret, requestCode });

    // After login, try to fetch funds to return with login response
    let funds = null;
    try {
      funds = await brokerService.getFunds();
    } catch (fundsErr) {
      logger.warn("Failed to fetch funds after login", { message: fundsErr.message });
    }

    res.json({
      ...result,
      funds: funds || null,
    });
  } catch (error) {
    logger.error("Auth login endpoint failed", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Broker login failed: " + error.message,
    });
  }
}

// POST /auth/logout
function logout(req, res) {
  const result = brokerService.logout();
  res.json(result);
}

// GET /auth/funds
async function funds(req, res) {
  try {
    const result = await brokerService.getFunds();
    res.json(result);
  } catch (error) {
    logger.error("Auth funds endpoint failed", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch account funds: " + error.message,
    });
  }
}

// GET /auth/status
function status(req, res) {
  const result = brokerService.getStatus();
  res.json(result);
}

module.exports = {
  login,
  logout,
  status,
  funds,
};
