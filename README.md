# Finance Manager

**Module 1** — signup/login, income management, expense management, expense
history, edit/delete. The foundation every later module builds on.

**Module 2** — automatic expense categorization. As you type an expense
description, a Python ML service predicts its category and pre-fills the
dropdown (you can still override it).

**Module 3** — budget management & alerts. Set monthly spending limits by
category (e.g. Food ₹5,000, Transport ₹3,000), monitor spending vs remaining
budget in real-time, visual color-coded progress bars, and proactive rule-based
alerts (⚠️ 85% budget used, 🚨 budget exceeded).

**Module 4** — monthly savings prediction. Uses trained regression algorithms (Linear Regression, Decision Tree, Random Forest) to forecast expected monthly savings based on income, expense breakdown, and historical saving habits. Includes an interactive what-if simulator.

**Module 5** — financial health analysis. Evaluates the user's financial wellness using a 5-pillar scoring framework (0 - 100): Savings Ratio, Expense-to-Income Ratio, Budget Adherence, Discretionary Spending Ratio, and Consistency of Savings. Provides dynamic, quantitative rule-based recommendations and an interactive score improvement simulator.

**Stack:** React (Vite) + Node/Express + MongoDB for the app, Python (Flask +
scikit-learn) for the ML service.

## Folder structure

```
finance-manager/
├── backend/          Express API (auth, income, expense, categorize, budget, savings, health routes)
├── frontend/          React app (login, signup, dashboard, budget manager, savings predictor, health analyzer)
└── ml-service/         Python Flask API for expense categorization (M2) & savings prediction (M4)
```

## Running everything (3 terminals)

1. `ml-service` → see `ml-service/README.md` → `python app.py` (port 8000)
2. `backend` → `npm run dev` (port 5000)
3. `frontend` → `npm run dev` (port 5173)

Module 1 (login, income, expenses), Module 3 (budgets & alerts), and Module 5 (financial health analysis) work fine
even if the ML service isn't running.

## Prerequisites

- Node.js 18+ installed
- MongoDB running locally, OR a free MongoDB Atlas cluster (https://www.mongodb.com/cloud/atlas)

## 1. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set:
- `MONGO_URI` — your local or Atlas connection string
- `JWT_SECRET` — any long random string (e.g. run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

Start the server:

```bash
npm run dev
```

You should see `Server running on http://localhost:5000` and `MongoDB connected successfully`.

## 2. Set up the frontend

In a **new terminal**:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## 3. Try the full demo flow (Modules 1 to 5)

1. Sign up with a name, email, password
2. You're logged in automatically → Dashboard
3. Add income (e.g. Salary, ₹40,000)
4. Go to **🎯 Budget Management (Module 3)** tab:
   - Set a budget for **Food**: ₹5,000
   - Set a budget for **Transport**: ₹3,000
5. Switch to **💳 Transactions** tab:
   - Add an expense: ₹4,200 for "Dinner at restaurant" (Category: Food)
   - Notice the suggested category from ML service (Module 2)!
6. Check the Budget:
   - Food spending is now ₹4,200 / ₹5,000 (84% spent, ₹800 remaining).
   - Add another ₹100 expense in Food → triggers **⚠️ You have used 86% of your Food budget.**
   - Add another ₹1,000 expense in Food → triggers **🚨 Food budget exceeded!** alert banner.
7. Go to **💰 Savings Prediction (Module 4)** tab:
   - View your machine learning predicted savings and projected savings rate.
   - Test the interactive "What-If" simulator adjusting income and expenses.
8. Go to **🏥 Financial Health (Module 5)** tab:
   - View your overall Financial Health Score (e.g. 78/100).
   - Check the 5 weighted pillars: Savings Ratio, Expense Ratio, Budget Adherence, Discretionary Spending, Consistency.
   - Read personalized rule-based recommendations (e.g. "Try reducing shopping expenses by 15%").
   - Test the interactive score improvement simulator.

## API reference (for your own testing/documentation)

| Method | Route                   | Auth required | Purpose                                                                    |
|--------|-------------------------|:---:|----------------------------------------------------------------------------|
| POST   | /api/auth/signup        | No  | Create account                                                             |
| POST   | /api/auth/login         | No  | Log in, get JWT                                                            |
| GET    | /api/auth/me            | Yes | Get current user                                                           |
| POST   | /api/income             | Yes | Add income                                                                 |
| GET    | /api/income             | Yes | List income                                                                |
| PUT    | /api/income/:id         | Yes | Edit income                                                                |
| DELETE | /api/income/:id         | Yes | Delete income                                                              |
| POST   | /api/expense            | Yes | Add expense                                                                |
| GET    | /api/expense            | Yes | List expenses (supports `?category=` and `?month=YYYY-MM`)                 |
| PUT    | /api/expense/:id        | Yes | Edit expense                                                               |
| DELETE | /api/expense/:id        | Yes | Delete expense                                                             |
| POST   | /api/categorize/suggest | Yes | (Module 2) Predicts category from description via Python ML service         |
| POST   | /api/budget             | Yes | (Module 3) Create or update monthly budget for a category                  |
| GET    | /api/budget             | Yes | (Module 3) List user budgets for a month (`?month=YYYY-MM`)                |
| PUT    | /api/budget/:id         | Yes | (Module 3) Edit a budget amount                                            |
| DELETE | /api/budget/:id         | Yes | (Module 3) Delete a budget entry                                           |
| GET    | /api/budget/status      | Yes | (Module 3) Compute spending vs budget, remaining, %, and rule-based alerts  |
| GET    | /api/savings/predict    | Yes | (Module 4) Automated ML prediction of monthly savings from user records    |
| POST   | /api/savings/simulate   | Yes | (Module 4) Interactive what-if scenario savings simulator                  |
| GET    | /api/savings/history    | Yes | (Module 4) User's actual historical monthly savings track record           |
| GET    | /api/financial-health   | Yes | (Module 5) Financial Health Score (0-100), 5 pillars, and recommendations |

Protected routes expect a header: `Authorization: Bearer <token>` (handled automatically
by the frontend once you're logged in).

## Where this fits in your 8-module plan

This app currently implements **Module 1** (User & Expense Management), **Module 2** (Automatic Expense Categorization), **Module 3** (Budget Management & Alerts), **Module 4** (Monthly Savings Prediction), and **Module 5** (Financial Health Analysis). Next up is **Module 6** (Investment Recommendation).
