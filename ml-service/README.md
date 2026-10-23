# ML Service (Module 2 & Module 4)

A Python service that provides Machine Learning endpoints for:
1. **Module 2: Automatic Expense Categorization** — predicts category from text using TF-IDF + Logistic Regression.
2. **Module 4: Monthly Savings Prediction** — predicts expected monthly savings using regression algorithms (Linear Regression, Decision Tree, Random Forest) evaluated on MAE, RMSE, and R² scores.

## What's in here

- `dataset.csv` — labeled training examples for categorization (description → category)
- `train_model.py` — cleans text, trains and compares 3 classification models, saves category model
- `generate_savings_data.py` — generates realistic financial profiles with income, expenses, and savings
- `savings_dataset.csv` — dataset with 3,000 monthly financial records for regression
- `train_savings_model.py` — trains Linear Regression, Decision Tree, and Random Forest; evaluates MAE, RMSE, R²; saves champion model to `model/savings_model.pkl`
- `app.py` — Flask API serving both categorization (`/predict`) and savings prediction (`/predict-savings`, `/savings-model-info`)
- `model/` — where saved models and evaluation metadata are stored

## Setup

You'll need Python 3.9+ installed. Check with `python --version`.

```bash
cd ml-service
python -m venv venv
```

Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

Then install dependencies:

```bash
pip install -r requirements.txt
```

## Train the model

```bash
python train_model.py
```

This prints an accuracy comparison across the 3 models, picks the best one,
and saves it to `model/category_model.pkl` and `model/vectorizer.pkl`.

Re-run this any time you edit `dataset.csv` to add more training examples —
more examples (especially realistic, varied ones) means better predictions.

## Run the prediction API

```bash
python app.py
```

This starts a server at `http://localhost:8000`. Test it directly:

```bash
curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" -d "{\"description\": \"Uber ride\"}"
```

Expected response:
```json
{"category": "Transport", "confidence": 0.82}
```

## How it connects to the rest of the app

```
React frontend  --(as you type a description)-->  Node backend
                                                        |
                                              POST /api/categorize/suggest
                                                        |
                                                        v
                                         Flask ML service (this folder)
                                                        |
                                              predicted category back
```

The Node backend's `.env` needs `ML_SERVICE_URL=http://localhost:8000`
(already set as the default). Keep this service running alongside your
backend and frontend — that's now 3 terminals total:

1. `ml-service` → `python app.py`
2. `backend` → `npm run dev`
3. `frontend` → `npm run dev`

## Improving the model later

- Add more (and more varied/realistic) rows to `dataset.csv`
- Export real expense descriptions your Module 1 users enter, label them,
  and fold them back into the dataset — this is exactly how production ML
  systems keep improving
- Try more advanced models (e.g. a small neural network) once the basics work
  and you want to compare results in your project report
