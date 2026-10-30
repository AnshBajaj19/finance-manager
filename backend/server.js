require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const incomeRoutes = require("./routes/income");
const expenseRoutes = require("./routes/expense");
const categorizeRoutes = require("./routes/categorize");
const budgetRoutes = require("./routes/budget");
const summaryRoutes = require("./routes/summary");
const savingsRoutes = require("./routes/savings");
const financialHealthRoutes = require("./routes/financialHealth");

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
  res.json({ message: "Finance Manager API is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/income", incomeRoutes);
app.use("/api/expense", expenseRoutes);
app.use("/api/categorize", categorizeRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/savings", savingsRoutes);
app.use("/api/financial-health", financialHealthRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
