"""
LoanGen AI - Flask backend
Serves a 4-tab web app (Home, Prediction, Data Overview, EDA) that wraps
two pre-trained loan-approval models (Logistic Regression + Decision Tree).
"""

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DATA_PATH = BASE_DIR / "data" / "cleaned_loan_dataset.csv"

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Load models once at startup
# ---------------------------------------------------------------------------
lr_model = joblib.load(MODELS_DIR / "logistic_regression_model.pkl")
lr_scaler = joblib.load(MODELS_DIR / "logistic_regression_scaler.pkl")
lr_features = joblib.load(MODELS_DIR / "logistic_regression_features.pkl")

dt_model = joblib.load(MODELS_DIR / "decision_tree_model.pkl")
dt_features = joblib.load(MODELS_DIR / "decision_tree_features.pkl")

df = pd.read_csv(DATA_PATH)

# Columns the user fills in on the form (before one-hot encoding).
# Only (field, label, unit) are hardcoded for display purposes — the actual
# min/max bounds shown as placeholders are computed straight from the
# dataset below, so the form never suggests a value outside real data.
FIELD_META = [
    ("Age", "Age", "years"),
    ("AnnualIncome", "Annual Income", "$"),
    ("Experience", "Work Experience", "years"),
    ("LoanAmount", "Loan Amount", "$"),
    ("LoanDuration", "Loan Duration", "months"),
    ("CreditScore", "Credit Score", ""),
    ("RiskScore", "Risk Score", ""),
    ("MonthlyDebtPayments", "Monthly Debt Payments", "$"),
    ("SavingsAccountBalance", "Savings Balance", "$"),
    ("NetWorth", "Net Worth", "$"),
    ("LengthOfCreditHistory", "Credit History Length", "years"),
    ("NumberOfDependents", "Dependents", ""),
    ("NumberOfOpenCreditLines", "Open Credit Lines", ""),
    ("BankruptcyHistory", "Bankruptcy History (0/1)", ""),
    ("PreviousLoanDefaults", "Previous Defaults (0/1)", ""),
    ("CheckingAccountBalance", "Checking Balance", "$"),
    ("TotalLiabilities", "Total Liabilities", "$"),
    ("CreditCardUtilizationRate", "CC Utilization Rate", "%"),
    ("NumberOfCreditInquiries", "Credit Inquiries", "", ),
    ("PaymentHistory", "Payment History Score", ""),
    ("TotalAssets", "Total Assets", "$"),
    ("JobTenure", "Job Tenure", "years"),
    ("InterestRate", "Interest Rate", "%"),
    ("MonthlyIncome", "Monthly Income", "$"),
    ("MonthlyLoanPayment", "Monthly Loan Payment", "$"),
    ("TotalDebtToIncomeRatio", "Debt-to-Income Ratio", "%"),
]


def _bound(value):
    """Return dataset min/max as an int when the column is whole-numbered,
    otherwise round to 2 decimals — keeps placeholders clean either way."""
    return int(value) if float(value).is_integer() else round(float(value), 2)


NUMERIC_FIELDS = [
    (field, label, unit, _bound(df[field].min()), _bound(df[field].max()))
    for field, label, unit in FIELD_META
    if field in df.columns
]

CATEGORICAL_FIELDS = {
    "EmploymentStatus": ["Employed", "Self-Employed", "Unemployed"],
    "EducationLevel": ["High School", "Associate", "Bachelor", "Master", "Doctorate"],
    "MaritalStatus": ["Single", "Married", "Divorced", "Widowed"],
    "HomeOwnershipStatus": ["Rent", "Own", "Mortgage", "Other"],
    "LoanPurpose": ["Auto", "Debt Consolidation", "Education", "Home", "Other"],
}


def build_feature_row(payload: dict, feature_list: list) -> pd.DataFrame:
    """Turn a flat form payload into a one-hot-encoded row matching a model's
    expected feature order. Unknown / unlisted one-hot columns default to 0,
    which mirrors how the categorical baseline (Employed / High School /
    Divorced / Mortgage / Auto) is implicitly represented in this encoding."""
    row = {feat: 0 for feat in feature_list}

    for field, *_ in NUMERIC_FIELDS:
        if field in row and field in payload:
            row[field] = float(payload[field])

    for cat_field, options in CATEGORICAL_FIELDS.items():
        chosen = payload.get(cat_field)
        col = f"{cat_field}_{chosen}"
        if col in row:
            row[col] = 1

    return pd.DataFrame([[row[f] for f in feature_list]], columns=feature_list)


# ---------------------------------------------------------------------------
# Precompute Data Overview + EDA payloads once (dataset does not change)
# ---------------------------------------------------------------------------
def compute_overview():
    approved = int(df["LoanApproved"].sum())
    total = len(df)
    return {
        "rows": total,
        "columns": df.shape[1],
        "approved": approved,
        "rejected": total - approved,
        "approval_rate": round(approved / total * 100, 2),
        "missing_values": int(df.isnull().sum().sum()),
        "date_range": [
            df["ApplicationDate_financial"].min(),
            df["ApplicationDate_financial"].max(),
        ],
        "avg_credit_score": round(df["CreditScore"].mean(), 1),
        "avg_loan_amount": round(df["LoanAmount"].mean(), 2),
        "avg_annual_income": round(df["AnnualIncome"].mean(), 2),
        "columns_list": [
            {"name": c, "dtype": str(df[c].dtype)} for c in df.columns
        ],
        "sample_rows": json.loads(
            df.drop(columns=["ID"]).head(6).to_json(orient="records")
        ),
    }


def compute_eda():
    numeric_cols = [
        "CreditScore", "AnnualIncome", "Age", "LoanAmount",
        "RiskScore", "TotalDebtToIncomeRatio", "InterestRate",
        "LengthOfCreditHistory",
    ]

    # Histograms split by approval status (10 bins each)
    histograms = {}
    for col in numeric_cols:
        bins = np.histogram_bin_edges(df[col], bins=10)
        approved_hist, _ = np.histogram(df.loc[df.LoanApproved == 1, col], bins=bins)
        rejected_hist, _ = np.histogram(df.loc[df.LoanApproved == 0, col], bins=bins)
        labels = [f"{int(bins[i])}" for i in range(len(bins) - 1)]
        histograms[col] = {
            "labels": labels,
            "approved": approved_hist.tolist(),
            "rejected": rejected_hist.tolist(),
        }

    # Approval rate by categorical field
    category_approval = {}
    for cat_field, options in CATEGORICAL_FIELDS.items():
        rates = df.groupby(cat_field)["LoanApproved"].mean() * 100
        counts = df.groupby(cat_field)["LoanApproved"].count()
        ordered = [o for o in options if o in rates.index]
        category_approval[cat_field] = {
            "labels": ordered,
            "rates": [round(rates[o], 2) for o in ordered],
            "counts": [int(counts[o]) for o in ordered],
        }

    # Correlation of numeric fields with target
    corr_cols = [c for c, *_ in NUMERIC_FIELDS if c in df.columns]
    correlations = df[corr_cols + ["LoanApproved"]].corr()["LoanApproved"].drop("LoanApproved")
    correlations = correlations.sort_values(key=lambda s: s.abs(), ascending=False).head(12)

    # Scatter sample (down-sampled for the browser)
    sample_df = df.sample(n=min(600, len(df)), random_state=42)
    scatter = {
        "credit_vs_risk": {
            "approved": sample_df.loc[sample_df.LoanApproved == 1, ["CreditScore", "RiskScore"]].values.tolist(),
            "rejected": sample_df.loc[sample_df.LoanApproved == 0, ["CreditScore", "RiskScore"]].values.tolist(),
        }
    }

    return {
        "histograms": histograms,
        "category_approval": category_approval,
        "correlations": {
            "labels": correlations.index.tolist(),
            "values": [round(v, 3) for v in correlations.values.tolist()],
        },
        "scatter": scatter,
        "target_split": {
            "labels": ["Approved", "Rejected"],
            "values": [int(df.LoanApproved.sum()), int((df.LoanApproved == 0).sum())],
        },
    }


OVERVIEW_CACHE = compute_overview()
EDA_CACHE = compute_eda()


# ---------------------------------------------------------------------------
# Page routes
# ---------------------------------------------------------------------------
@app.route("/")
def home():
    return render_template("home.html", active="home")


@app.route("/prediction")
def prediction():
    return render_template(
        "prediction.html",
        active="prediction",
        numeric_fields=NUMERIC_FIELDS,
        categorical_fields=CATEGORICAL_FIELDS,
    )


@app.route("/data-overview")
def data_overview():
    return render_template("data_overview.html", active="data-overview")


@app.route("/eda")
def eda():
    return render_template("eda.html", active="eda")


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------
@app.route("/api/predict", methods=["POST"])
def api_predict():
    payload = request.get_json(force=True)
    model_choice = payload.get("model", "logistic")

    try:
        if model_choice == "logistic":
            row = build_feature_row(payload, lr_features)
            scaled = lr_scaler.transform(row)
            pred = int(lr_model.predict(scaled)[0])
            prob = float(lr_model.predict_proba(scaled)[0][1])
            model_label = "Logistic Regression"
        else:
            row = build_feature_row(payload, dt_features)
            pred = int(dt_model.predict(row)[0])
            prob = float(dt_model.predict_proba(row)[0][1])
            model_label = "Decision Tree"

        return jsonify(
            {
                "ok": True,
                "model": model_label,
                "prediction": pred,
                "approved": bool(pred == 1),
                "probability": round(prob * 100, 2),
            }
        )
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(exc)}), 400


@app.route("/api/dataset-overview")
def api_dataset_overview():
    return jsonify(OVERVIEW_CACHE)


@app.route("/api/eda")
def api_eda():
    return jsonify(EDA_CACHE)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000, use_reloader=False)
