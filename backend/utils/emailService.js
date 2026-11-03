const nodemailer = require("nodemailer");

// In-memory log of recently dispatched alert emails (useful for demonstration and test verification)
const recentEmailLogs = [];

let cachedTransporter = null;
let etherealAccount = null;

/**
 * Initializes or retrieves the nodemailer transporter
 */
async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  // 1. If explicit SMTP credentials are provided in .env
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(`[EmailService] Configured custom SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
    return cachedTransporter;
  }

  // 2. If Gmail user & app password provided
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log(`[EmailService] Configured Gmail SMTP for ${process.env.EMAIL_USER}`);
    return cachedTransporter;
  }

  // 3. Fallback: Create an Ethereal test account automatically for local zero-config demonstration
  try {
    if (!etherealAccount) {
      etherealAccount = await nodemailer.createTestAccount();
      console.log(`[EmailService] Ethereal test account created: ${etherealAccount.user}`);
    }
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass,
      },
    });
    return cachedTransporter;
  } catch (err) {
    console.warn("[EmailService] Could not create Ethereal account, using JSON logging fallback:", err.message);
    return null;
  }
}

/**
 * Send an HTML email alert to the user
 */
async function sendAlertEmail({ to, recipientName, alertType, title, message, metadata = {} }) {
  const fromAddress = process.env.EMAIL_FROM || '"Finance Manager Alerts" <alerts@financemanager.local>';
  const subject = `[Finance Manager Alert] ${title}`;

  const amountStr = metadata.amount ? `₹${Number(metadata.amount).toLocaleString()}` : "";
  const categoryStr = metadata.category || "General";
  const descStr = metadata.description || "Expense";
  const avgStr = metadata.categoryAverage ? `₹${Math.round(metadata.categoryAverage).toLocaleString()}` : "N/A";
  const multStr = metadata.multiplier ? `${metadata.multiplier.toFixed(1)}x` : "";

  let badgeColor = "#dc2626";
  let badgeText = "ANOMALY DETECTED";
  if (alertType === "budget_exceeded") {
    badgeColor = "#ea580c";
    badgeText = "BUDGET EXCEEDED";
  } else if (alertType === "high_spending") {
    badgeColor = "#d97706";
    badgeText = "HIGH SPENDING SPIKE";
  } else if (alertType === "low_savings") {
    badgeColor = "#4f46e5";
    badgeText = "SAVINGS NOTICE";
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .header { background: #1e293b; color: #ffffff; padding: 24px; text-align: center; }
    .badge { display: inline-block; padding: 5px 14px; border-radius: 20px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px; background: ${badgeColor}; color: #ffffff; margin-bottom: 8px; }
    .content { padding: 28px; }
    .amount-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px; margin: 16px 0; text-align: center; }
    .amount-value { font-size: 32px; font-weight: 800; color: #dc2626; margin: 4px 0; }
    .data-table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 14px; }
    .data-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    .data-table td.label { color: #64748b; font-weight: 600; width: 40%; }
    .data-table td.val { font-weight: 700; color: #1e293b; }
    .callout { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 6px; font-size: 13.5px; color: #92400e; margin: 18px 0; line-height: 1.45; }
    .btn-container { text-align: center; margin-top: 26px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 14px; }
    .footer { text-align: center; padding: 18px; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">${badgeText}</span>
      <h2 style="margin: 6px 0 0; font-size: 22px;">Finance Manager Alert</h2>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Hello <strong>${recipientName || "User"}</strong>,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.5;">${message}</p>

      ${
        amountStr
          ? `
      <div class="amount-box">
        <span style="font-size: 12px; text-transform: uppercase; color: #991b1b; font-weight: 600;">Flagged Transaction</span>
        <div class="amount-value">${amountStr}</div>
        <span style="font-size: 14px; color: #7f1d1d; font-weight: 600;">${categoryStr} · ${descStr}</span>
      </div>
      `
          : ""
      }

      <table class="data-table">
        ${categoryStr ? `<tr><td class="label">Category</td><td class="val">${categoryStr}</td></tr>` : ""}
        ${descStr ? `<tr><td class="label">Description</td><td class="val">${descStr}</td></tr>` : ""}
        ${avgStr !== "N/A" ? `<tr><td class="label">Your Category Average</td><td class="val">${avgStr}</td></tr>` : ""}
        ${multStr ? `<tr><td class="label">Deviation Factor</td><td class="val" style="color: #dc2626;">${multStr} of baseline average</td></tr>` : ""}
        ${metadata.zScore ? `<tr><td class="label">Statistical Z-Score</td><td class="val">${metadata.zScore.toFixed(2)} (High Outlier)</td></tr>` : ""}
        ${metadata.budgetAmount ? `<tr><td class="label">Monthly Budget Limit</td><td class="val">₹${Number(metadata.budgetAmount).toLocaleString()}</td></tr>` : ""}
      </table>

      <div class="callout">
        <strong>💡 Action Recommended:</strong> Verify if this expense was planned or check your remaining budget limits in Module 3. If this was an unexpected transaction, please review your account activity.
      </div>

      <div class="btn-container">
        <a href="http://localhost:5173" class="btn">View in Finance Manager</a>
      </div>
    </div>
    <div class="footer">
      Sent by Finance Manager — Module 7 Alerts & Anomaly Detection System.<br>
      You received this email because alerts are enabled on your account.
    </div>
  </div>
</body>
</html>
  `;

  const text = `
[Finance Manager Alert] ${title}

Hello ${recipientName || "User"},

${message}

Transaction: ${amountStr} (${categoryStr} - ${descStr})
Category Average: ${avgStr}
${multStr ? `Deviation Factor: ${multStr}` : ""}
${metadata.zScore ? `Statistical Z-Score: ${metadata.zScore.toFixed(2)}` : ""}

Action Recommended: Review your dashboard at http://localhost:5173

Sent by Finance Manager Module 7.
  `.trim();

  try {
    const transporter = await getTransporter();

    if (!transporter) {
      const simulatedLog = {
        id: `sim_${Date.now()}`,
        timestamp: new Date(),
        to,
        subject,
        previewUrl: null,
        mode: "simulated_console",
      };
      recentEmailLogs.unshift(simulatedLog);
      if (recentEmailLogs.length > 50) recentEmailLogs.pop();
      console.log(`[EmailService - Simulated] To: ${to} | Subject: ${subject}`);
      return { success: true, simulated: true, log: simulatedLog };
    }

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    const emailLog = {
      id: info.messageId,
      timestamp: new Date(),
      to,
      subject,
      previewUrl,
      mode: previewUrl ? "ethereal_test" : "smtp_live",
    };
    recentEmailLogs.unshift(emailLog);
    if (recentEmailLogs.length > 50) recentEmailLogs.pop();

    console.log(`[EmailService] Alert email delivered to ${to} (MessageId: ${info.messageId})`);
    if (previewUrl) {
      console.log(`[EmailService] View Ethereal preview at: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (err) {
    console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Send a verification / test alert email
 */
async function sendTestEmail({ to, recipientName }) {
  return sendAlertEmail({
    to,
    recipientName,
    alertType: "unusual_expense",
    title: "Test Alert & Anomaly Notification",
    message: "This is a verification test email confirming that your Finance Manager Module 7 email notifications are successfully configured and working!",
    metadata: {
      amount: 4500,
      category: "Food",
      description: "Dinner at luxury restaurant (Sample Test)",
      categoryAverage: 450,
      multiplier: 10.0,
      zScore: 3.14,
    },
  });
}

function getRecentEmailLogs() {
  return recentEmailLogs;
}

module.exports = {
  sendAlertEmail,
  sendTestEmail,
  getRecentEmailLogs,
};

