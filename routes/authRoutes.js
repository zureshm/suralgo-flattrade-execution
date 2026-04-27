const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// POST /auth/login — Login to broker
router.post("/login", authController.login);

// POST /auth/logout — Disconnect broker session
router.post("/logout", authController.logout);

// GET /auth/status — Check broker session status
router.get("/status", authController.status);

// GET /auth/funds — Get account balance/margin info
router.get("/funds", authController.funds);

module.exports = router;
