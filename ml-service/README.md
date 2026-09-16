# Module 2 — Automatic Expense Categorization (ML Service)

A small Python service that predicts an expense's category from its text
description, using TF-IDF + a classifier trained on `dataset.csv`.

## What's in here

- `dataset.csv` — labeled training examples (description → category)
- `train_model.py` — cleans the text, trains and compares 3 models (Logistic
  Regression, Naive Bayes, Linear SVM), picks the best one, saves it
- `app.py` — Flask API that loads the saved model and serves predictions
- `model/` — where the trained model files get saved (created by `train_model.py`)

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
