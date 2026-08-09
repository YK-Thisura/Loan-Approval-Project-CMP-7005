# LoanGen AI

A Flask web app that wraps two pre-trained loan-approval models (Logistic
Regression and Decision Tree) behind a dashboard with four tabs: **Home**,
**Prediction**, **Data Overview**, and **EDA**.

## Setup

```bash
cd loangen-ai
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

## Project structure

```
loangen-ai/
├── app.py                     # Flask app: routes, model loading, EDA/overview stats
├── requirements.txt
├── models/
│   ├── logistic_regression_model.pkl
│   ├── logistic_regression_scaler.pkl
│   ├── logistic_regression_features.pkl
│   ├── decision_tree_model.pkl
│   └── decision_tree_features.pkl
├── data/
│   └── cleaned_loan_dataset.csv   # used to power Data Overview + EDA
├── templates/
│   ├── base.html               # navbar (links left, logo right) + footer
│   ├── home.html                # hero + feature strip
│   ├── prediction.html          # model picker + input form + result gauge
│   ├── data_overview.html       # dataset stats, columns, sample rows
│   └── eda.html                 # charts: approval by category, distributions,
│                                 #   correlations, scatter
└── static/
    ├── css/style.css            # design system (#22F89F / #474747 dark theme)
    ├── js/
    │   ├── prediction.js         # form submit → /api/predict → animated gauge
    │   ├── data_overview.js      # populates /api/dataset-overview
    │   ├── eda.js                # renders all EDA charts from /api/eda
    │   └── vendor/chart.umd.min.js  # Chart.js, bundled locally (no CDN needed)
```

## How prediction works

The Prediction tab form collects the same fields used in your original
training/testing scripts (Age, AnnualIncome, CreditScore, RiskScore, etc.)
plus the 5 categorical fields (EmploymentStatus, EducationLevel,
MaritalStatus, HomeOwnershipStatus, LoanPurpose). On submit, the form posts
JSON to `/api/predict`, which:

1. Builds a one-hot-encoded feature row matching the exact column order the
   selected model was trained on (`logistic_regression_features.pkl` or
   `decision_tree_features.pkl`).
2. For Logistic Regression, scales the row with `logistic_regression_scaler.pkl`
   before predicting.
3. Returns `{ prediction, approved, probability }`, which the frontend
   renders as an animated probability gauge and an APPROVED / REJECTED badge —
   the same output format as your original scripts
   (`Loan Approval Probability: 99.87% ✅ Predicted Result: APPROVED`).

## Data Overview & EDA

Both pages are backed by `cleaned_loan_dataset.csv` (20,000 rows). Stats and
chart data (histograms, category approval rates, correlations, a 600-point
credit-score-vs-risk-score scatter sample) are computed once at server
startup with pandas/numpy and served as JSON from `/api/dataset-overview`
and `/api/eda`, so the pages load fast and the charts (via Chart.js) are
interactive.

## Notes

- Chart.js is vendored locally in `static/js/vendor/` — no external CDN
  dependency for the charts themselves.
- Google Fonts (Space Grotesk / Inter / JetBrains Mono) are loaded from
  `fonts.googleapis.com` in `base.html`. If you need a fully offline build,
  swap that `<link>` for self-hosted font files.
- This runs on Flask's built-in dev server. For production, put it behind a
  real WSGI server (gunicorn/uwsgi) and a reverse proxy.
