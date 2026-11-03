const express = require("express");
const mongoose = require("mongoose");
const AlertNotification = require("../models/AlertNotification");
const AlertSettings = require("../models/AlertSettings");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { scanAllUserAnomalies, detectExpenseAnomaly } = require("../utils/anomalyDetector");
const { sendTestEmail, getRecentEmailLogs } = require("../utils/emailService");

const router = express.Router();
router.use(auth);

/**
 * GET /api/alerts
 * List notifications for the authenticated user
 */
router.get("/", async (req, res) => {
  try {
    const { unread, limit = 50 } = req.query;
    const query = { user_id: req.userId };
    if (unread === "true") query.is_read = false;

    const notifications = await AlertNotification.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const unreadCount = await AlertNotification.countDocuments({
      user_id: req.userId,
      is_read: false,
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error("Error fetching alerts:", err);
    res.status(500).json({ message: "Could not fetch alerts.", error: err.message });
  }
});

/**
 * GET /api/alerts/unread-count
 * Fast endpoint for notification badge counter
 */
router.get("/unread-count", async (req, res) => {
  try {
    const unreadCount = await AlertNotification.countDocuments({
      user_id: req.userId,
      is_read: false,
    });
    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ message: "Failed to get unread count.", error: err.message });
  }
});

/**
 * PUT /api/alerts/:id/read
 * Mark a single notification as read
 */
router.put("/:id/read", async (req, res) => {
  try {
    const notification = await AlertNotification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { $set: { is_read: true } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found." });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: "Could not mark alert as read.", error: err.message });
  }
});

/**
 * PUT /api/alerts/read-all
 * Mark all notifications as read for current user
 */
router.put("/read-all", async (req, res) => {
  try {
    await AlertNotification.updateMany(
      { user_id: req.userId, is_read: false },
      { $set: { is_read: true } }
    );
    res.json({ message: "All alerts marked as read." });
  } catch (err) {
    res.status(500).json({ message: "Could not mark alerts as read.", error: err.message });
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete a notification
 */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await AlertNotification.findOneAndDelete({
      _id: req.params.id,
      user_id: req.userId,
    });
    if (!deleted) return res.status(404).json({ message: "Notification not found." });
    res.json({ message: "Alert deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Could not delete alert.", error: err.message });
  }
});

/**
 * GET /api/alerts/anomalies
 * Comprehensive scan of user's spending data to detect anomalies and category spikes
 */
router.get("/anomalies", async (req, res) => {
  try {
    const anomalies = await scanAllUserAnomalies(req.userId);
    res.json({
      totalAnomaliesDetected: anomalies.length,
      anomalies,
    });
  } catch (err) {
    console.error("Error scanning anomalies:", err);
    res.status(500).json({ message: "Could not scan anomalies.", error: err.message });
  }
});

/**
 * GET /api/alerts/settings
 * Retrieve alert & email preferences for user
 */
router.get("/settings", async (req, res) => {
  try {
    let settings = await AlertSettings.findOne({ user_id: req.userId });
    if (!settings) {
      settings = await AlertSettings.create({ user_id: req.userId });
    }
    const user = await User.findById(req.userId).select("email name");
    res.json({
      settings,
      userEmail: user?.email || "",
      userName: user?.name || "",
    });
  } catch (err) {
    res.status(500).json({ message: "Could not fetch alert settings.", error: err.message });
  }
});

/**
 * PUT /api/alerts/settings
 * Update alert & email preferences
 */
router.put("/settings", async (req, res) => {
  try {
    const {
      email_alerts_enabled,
      notify_unusual_expenses,
      notify_budget_exceeded,
      notify_high_spending,
      anomaly_threshold_multiplier,
      z_score_threshold,
    } = req.body;

    const updateFields = {};
    if (email_alerts_enabled !== undefined) updateFields.email_alerts_enabled = email_alerts_enabled;
    if (notify_unusual_expenses !== undefined) updateFields.notify_unusual_expenses = notify_unusual_expenses;
    if (notify_budget_exceeded !== undefined) updateFields.notify_budget_exceeded = notify_budget_exceeded;
    if (notify_high_spending !== undefined) updateFields.notify_high_spending = notify_high_spending;
    if (anomaly_threshold_multiplier !== undefined) {
      updateFields.anomaly_threshold_multiplier = Math.max(1.5, Math.min(10, Number(anomaly_threshold_multiplier)));
    }
    if (z_score_threshold !== undefined) {
      updateFields.z_score_threshold = Math.max(1.0, Math.min(5, Number(z_score_threshold)));
    }

    const settings = await AlertSettings.findOneAndUpdate(
      { user_id: req.userId },
      { $set: updateFields },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ message: "Alert settings updated successfully.", settings });
  } catch (err) {
    res.status(500).json({ message: "Could not update alert settings.", error: err.message });
  }
});

/**
 * POST /api/alerts/test-email
 * Send a verification test email alert to the user's registered email
 */
router.post("/test-email", async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.email) {
      return res.status(400).json({ message: "User email not found." });
    }

    const result = await sendTestEmail({
      to: user.email,
      recipientName: user.name,
    });

    if (result.success) {
      res.json({
        message: `Test alert email sent successfully to ${user.email}!`,
        recipient: user.email,
        previewUrl: result.previewUrl || null,
        simulated: !!result.simulated,
      });
    } else {
      res.status(500).json({
        message: `Failed to send email: ${result.error}`,
        error: result.error,
      });
    }
  } catch (err) {
    res.status(500).json({ message: "Email delivery error.", error: err.message });
  }
});

/**
 * POST /api/alerts/test-simulation
 * Evaluates a hypothetical transaction against user history without saving it
 */
router.post("/test-simulation", async (req, res) => {
  try {
    const { amount, category } = req.body;
    if (!amount || !category) {
      return res.status(400).json({ message: "Amount and category are required." });
    }

    const evaluation = await detectExpenseAnomaly(req.userId, {
      amount: Number(amount),
      category,
      _id: new mongoose.Types.ObjectId(),
    });

    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ message: "Error running anomaly simulation.", error: err.message });
  }
});

/**
 * GET /api/alerts/email-logs
 * Inspection endpoint for sent email history
 */
router.get("/email-logs", (req, res) => {
  const logs = getRecentEmailLogs();
  res.json({ logs });
});

module.exports = router;

