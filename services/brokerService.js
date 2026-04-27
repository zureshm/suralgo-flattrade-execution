const logger = require("../utils/logger");

// Flattrade NorenAPI base URL
const BASE_URL = "https://piconnect.flattrade.in/PiConnectAPI/";

// Broker session state
let userToken = null;
let userId = null;
let isLoggedIn = false;
let loginTime = null;

// ── Helper: Make NorenAPI POST request ──────────────────────────────────────

async function norenPost(endpoint, data, includeKey = true) {
  const url = `${BASE_URL}${endpoint}`;

  const payload = { ...data };
  if (includeKey && userId) {
    payload.uid = userId;
    payload.actid = userId;
  }

  const body = includeKey && userToken
    ? `jData=${JSON.stringify(payload)}&jKey=${userToken}`
    : `jData=${JSON.stringify(payload)}`;

  logger.info(`NorenAPI POST ${endpoint}`, { body: payload });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const result = await response.json();

  if (result.stat === "Not_Ok") {
    throw new Error(result.emsg || `Flattrade API error on ${endpoint}`);
  }

  return result;
}

// ── Login (set session with pre-generated token) ────────────────────────────

async function login({ userId: _userId, userToken: _userToken, apiKey, apiSecret, requestCode } = {}) {
  try {
    // If requestCode + apiKey + apiSecret are provided, generate token via API
    if (requestCode && apiKey && apiSecret) {
      const _apiKey = apiKey || process.env.FLATTRADE_API_KEY;
      const _apiSecret = apiSecret || process.env.FLATTRADE_API_SECRET;

      const crypto = require("crypto");
      const apiSecretHash = crypto
        .createHash("sha256")
        .update(`${_apiKey}${requestCode}${_apiSecret}`)
        .digest("hex");

      const tokenRes = await fetch("https://authapi.flattrade.in/trade/apitoken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: _apiKey,
          request_code: requestCode,
          api_secret: apiSecretHash,
        }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.stat === "Ok" && tokenData.token) {
        _userToken = tokenData.token;
        _userId = tokenData.client || _userId;
        logger.info("Token generated via Flattrade API", { userId: _userId });
      } else {
        throw new Error(tokenData.emsg || "Token generation failed");
      }
    }

    // Use provided values, fall back to .env
    const finalUserId = _userId || process.env.FLATTRADE_USER_ID;
    const finalToken = _userToken || process.env.FLATTRADE_USER_TOKEN;

    if (!finalUserId || !finalToken) {
      throw new Error("Missing credentials — userId and userToken are required (or provide requestCode + apiKey + apiSecret)");
    }

    // Validate session by calling UserDetails or Limits
    userId = finalUserId;
    userToken = finalToken;

    // Test the session with a limits call
    try {
      await norenPost("Limits", {});
      logger.info("Flattrade session validated via Limits call");
    } catch (err) {
      // If limits fails, session might still be valid for order ops
      logger.warn("Limits call during login validation failed (session may still be valid)", { message: err.message });
    }

    isLoggedIn = true;
    loginTime = new Date().toISOString();

    logger.info("Broker login success", {
      userId: finalUserId,
      loginTime,
    });

    return {
      success: true,
      userId: finalUserId,
      loginTime,
    };
  } catch (error) {
    isLoggedIn = false;
    userToken = null;
    userId = null;
    logger.error("Broker login failed", { message: error.message });
    throw error;
  }
}

// ── Session Status ───────────────────────────────────────────────────────────

function getStatus() {
  return {
    isLoggedIn,
    broker: process.env.BROKER || "flattrade",
    userId: isLoggedIn ? userId : null,
    loginTime,
  };
}

// ── Logout ──────────────────────────────────────────────────────────────────

function logout() {
  const wasLoggedIn = isLoggedIn;
  userToken = null;
  userId = null;
  isLoggedIn = false;
  loginTime = null;

  logger.info("Broker session logged out", { wasLoggedIn });

  return { success: true, message: "Logged out" };
}

// ── Account Funds (Limits) ──────────────────────────────────────────────────

async function getFunds() {
  ensureSession();

  try {
    const response = await norenPost("Limits", {});

    logger.info("Limits raw response", JSON.stringify(response));

    return {
      success: true,
      cash: parseFloat(response.cash || "0"),
      marginUsed: parseFloat(response.marginused || "0"),
      payin: parseFloat(response.payin || "0"),
      payout: parseFloat(response.payout || "0"),
      turnover: parseFloat(response.turnover || "0"),
      pendingOrderValue: parseFloat(response.pendordval || "0"),
      unrealizedMtm: parseFloat(response.urmtom || "0"),
      grossExposure: parseFloat(response.grexpo || "0"),
      raw: response,
    };
  } catch (error) {
    logger.error("Get funds failed", { message: error.message });
    throw error;
  }
}

// ── Ensure logged in ────────────────────────────────────────────────────────

function ensureSession() {
  if (!isLoggedIn || !userToken || !userId) {
    throw new Error("Not logged in — call /auth/login first with userId and userToken");
  }
}

// ── Place Order ─────────────────────────────────────────────────────────────

async function placeOrder({ symbol, qty, side, orderType, productType, price, triggerPrice }) {
  ensureSession();

  const exchange = "NFO";
  const tradingSymbol = symbol;

  // Map friendly names to Flattrade NorenAPI values
  const buySell = side === "BUY" ? "B" : "S";
  const priceType = mapOrderType(orderType);
  const product = mapProductType(productType);

  const orderParams = {
    exch: exchange,
    tsym: tradingSymbol,
    qty: String(qty),
    prc: String(price || "0"),
    trgprc: String(triggerPrice || "0"),
    prd: product,
    trantype: buySell,
    prctyp: priceType,
    ret: "DAY",
    ordersource: "API",
  };

  // Remove triggerPrice if not needed
  if (!triggerPrice || triggerPrice === "0") {
    delete orderParams.trgprc;
  }

  logger.order("Placing order", orderParams);

  try {
    const response = await norenPost("PlaceOrder", orderParams);

    logger.order("Order response", response);

    if (response.stat === "Ok" && response.norenordno) {
      return {
        success: true,
        orderId: response.norenordno,
        message: "Order placed",
        raw: response,
      };
    }

    return {
      success: false,
      message: response.emsg || "Order placement failed — no orderId",
      raw: response,
    };
  } catch (error) {
    logger.error("Place order failed", { message: error.message, params: orderParams });
    throw error;
  }
}

// ── Exit / Square-off Position ──────────────────────────────────────────────

async function exitOrder({ symbol, qty, side }) {
  // To exit a BUY position, we SELL. To exit a SELL position, we BUY.
  const exitSide = side === "SELL" ? "BUY" : "SELL";

  return placeOrder({
    symbol,
    qty,
    side: exitSide,
    orderType: "MARKET",
    productType: "INTRADAY",
  });
}

// ── Cancel Order ────────────────────────────────────────────────────────────

async function cancelOrder({ orderId }) {
  ensureSession();

  const params = {
    norenordno: orderId,
  };

  logger.order("Cancelling order", params);

  try {
    const response = await norenPost("CancelOrder", params);
    logger.order("Cancel response", response);
    return {
      success: true,
      message: "Order cancelled",
      orderId: response.result || orderId,
      raw: response,
    };
  } catch (error) {
    logger.error("Cancel order failed", { message: error.message, orderId });
    throw error;
  }
}

// ── Order Book ──────────────────────────────────────────────────────────────

async function getOrderBook() {
  ensureSession();

  try {
    const response = await norenPost("OrderBook", {});

    // Response is an array of orders on success
    const orders = Array.isArray(response) ? response : [];

    return {
      success: true,
      orders,
      raw: response,
    };
  } catch (error) {
    // "no data" is not really an error — just means no orders
    if (error.message && error.message.includes("no data")) {
      return { success: true, orders: [], raw: null };
    }
    logger.error("Get order book failed", { message: error.message });
    throw error;
  }
}

// ── Single Order Status ─────────────────────────────────────────────────────

async function getOrderStatus(orderId) {
  ensureSession();

  try {
    const response = await norenPost("SingleOrdHist", {
      norenordno: orderId,
    });

    // Response is an array of order history entries
    const history = Array.isArray(response) ? response : [response];

    if (history.length === 0) {
      return { success: false, message: "Order not found" };
    }

    // Return the latest state (last entry)
    return {
      success: true,
      order: history[history.length - 1],
      history,
    };
  } catch (error) {
    logger.error("Get order status failed", { message: error.message, orderId });
    throw error;
  }
}

// ── Positions ───────────────────────────────────────────────────────────────

async function getPositions() {
  ensureSession();

  try {
    const response = await norenPost("PositionBook", {});

    // Response is an array of positions on success
    const positions = Array.isArray(response) ? response : [];

    return {
      success: true,
      positions,
      raw: response,
    };
  } catch (error) {
    // "no data" means no positions
    if (error.message && error.message.includes("no data")) {
      return { success: true, positions: [], raw: null };
    }
    logger.error("Get positions failed", { message: error.message });
    throw error;
  }
}

// ── Trade Book ──────────────────────────────────────────────────────────────

async function getTradeBook() {
  ensureSession();

  try {
    const response = await norenPost("TradeBook", {});

    // Response is an array of trades on success
    const trades = Array.isArray(response) ? response : [];

    return {
      success: true,
      trades,
      raw: response,
    };
  } catch (error) {
    // "no data" means no trades
    if (error.message && error.message.includes("no data")) {
      return { success: true, trades: [], raw: null };
    }
    logger.error("Get trade book failed", { message: error.message });
    throw error;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapOrderType(type) {
  const map = {
    MARKET: "MKT",
    LIMIT: "LMT",
    "SL-LMT": "SL-LMT",
    "SL-MKT": "SL-MKT",
    STOPLOSS_LIMIT: "SL-LMT",
    STOPLOSS_MARKET: "SL-MKT",
    SL: "SL-LMT",
    SLM: "SL-MKT",
    MKT: "MKT",
    LMT: "LMT",
  };
  return map[(type || "").toUpperCase()] || "MKT";
}

function mapProductType(type) {
  const map = {
    INTRADAY: "I",
    MIS: "I",
    NRML: "M",
    CARRYFORWARD: "M",
    CNC: "C",
    DELIVERY: "C",
    I: "I",
    M: "M",
    C: "C",
  };
  return map[(type || "").toUpperCase()] || "I";
}

module.exports = {
  login,
  logout,
  getStatus,
  getFunds,
  ensureSession,
  placeOrder,
  exitOrder,
  cancelOrder,
  getOrderBook,
  getOrderStatus,
  getPositions,
  getTradeBook,
};
