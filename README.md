# Finance Manager

**Module 1** — signup/login, income management, expense management, expense
history, edit/delete. The foundation every later module builds on.

**Module 2** — automatic expense categorization. As you type an expense
description, a Python ML service predicts its category and pre-fills the
dropdown (you can still override it).

**Stack:** React (Vite) + Node/Express + MongoDB for the app, Python (Flask +
scikit-learn) for the ML service.

## Folder structure

```
finance-manager/
├── backend/          Express API (auth, income, expense, categorize routes)
├── frontend/          React app (login, signup, dashboard)
└── ml-service/         Python Flask API for expense categorization (Module 2)
```

## Running everything (3 terminals)

1. `ml-service` → see `ml-service/README.md` → `python app.py` (port 8000)
2. `backend` → `npm run dev` (port 5000)
3. `frontend` → `npm run dev` (port 5173)

Module 1 (login, income, expenses) works fine even if the ML service isn't
running — the category suggestion just silently won't appear, and you fall
back to picking a category manually.

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

## 3. Try the full demo flow

1. Sign up with a name, email, password
2. You're logged in automatically → Dashboard
3. Add income (e.g. Salary, ₹40,000)
4. Add an expense (e.g. ₹500, Dinner, Food, UPI)
5. Add a couple more expenses in different categories
6. Filter expenses by category and by month
7. Edit an expense, then delete one
8. Logout, then log back in — your data is still there (stored in MongoDB)

This is exactly the demo flow described in your project plan.

## API reference (for your own testing/documentation)

| Method | Route              | Auth required | Purpose               |
|--------|---------------------|:---:|------------------------|
| POST   | /api/auth/signup    | No  | Create account         |
| POST   | /api/auth/login     | No  | Log in, get JWT        |
| GET    | /api/auth/me        | Yes | Get current user       |
| POST   | /api/income         | Yes | Add income             |
| GET    | /api/income         | Yes | List income            |
| PUT    | /api/income/:id     | Yes | Edit income            |
| DELETE | /api/income/:id     | Yes | Delete income          |
| POST   | /api/expense        | Yes | Add expense            |
| GET    | /api/expense        | Yes | List expenses (supports `?category=` and `?month=YYYY-MM`) |
| PUT    | /api/expense/:id    | Yes | Edit expense           |
| DELETE | /api/expense/:id    | Yes | Delete expense         |

Protected routes expect a header: `Authorization: Bearer <token>` (handled automatically
by the frontend once you're logged in).

## Note on "Logout"

Since this uses JWT (stateless tokens), logout simply deletes the token from the browser
(`localStorage`) — there's no server-side session to close. This is standard for JWT auth
and fine to explain as-is to your supervisor.

## Where this fits in your 8-module plan

This app currently implements **Module 1** only. The `Income` and `Expense` collections
are structured so Modules 2 (categorization), 3 (budgets), 4 (savings prediction), 5
(financial health), and 7 (anomaly detection) can all read from this same data without
changes to the schema.
