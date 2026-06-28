"""
Flask application for the Health Prediction Interactive Dashboard.
Serves pages (Home, Dashboard, About) and JSON API endpoints for ML results.
"""

import os
from flask import Flask, render_template, jsonify, request
from data_processor import HealthDataProcessor

app = Flask(__name__)

# Initialize data processor
CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "health.csv")
processor = HealthDataProcessor(CSV_PATH)

# Pre-process data on startup
processor.load_data()
processor.clean_data()
processor.encode_data()
processor.scale_data()


# ─── PAGE ROUTES ─────────────────────────────────────────────────────────────

@app.route("/")
def home():
    """Render the Home page."""
    summary = processor.get_data_summary()
    return render_template("home.html", summary=summary)


@app.route("/dashboard")
def dashboard():
    """Render the interactive Dashboard page."""
    return render_template("dashboard.html")


@app.route("/about")
def about():
    """Render the About page."""
    return render_template("about.html")


@app.route("/predict")
def predict():
    """Render the Predict Risk page."""
    return render_template("predict.html")


# ─── API ENDPOINTS ───────────────────────────────────────────────────────────

@app.route("/api/data-summary")
def api_data_summary():
    """Return dataset statistics as JSON."""
    summary = processor.get_data_summary()
    return jsonify(summary)


@app.route("/api/kmeans")
def api_kmeans():
    """Run K-Means with optional ?k= parameter."""
    k = request.args.get("k", 3, type=int)
    k = max(2, min(k, 10))
    result = processor.run_kmeans(n_clusters=k)
    return jsonify(result)


@app.route("/api/elbow")
def api_elbow():
    """Return elbow method data."""
    result = processor.run_elbow(max_k=10)
    return jsonify(result)


@app.route("/api/dbscan")
def api_dbscan():
    """Run DBSCAN with optional ?eps= and ?min_samples= parameters."""
    eps = request.args.get("eps", 0.5, type=float)
    min_samples = request.args.get("min_samples", 5, type=int)
    eps = max(0.1, min(eps, 5.0))
    min_samples = max(2, min(min_samples, 20))
    result = processor.run_dbscan(eps=eps, min_samples=min_samples)
    return jsonify(result)


@app.route("/api/pca")
def api_pca():
    """Run PCA with optional ?n_components= parameter."""
    n = request.args.get("n_components", 2, type=int)
    result = processor.run_pca(n_components=n)
    return jsonify(result)


@app.route("/api/random-forest")
def api_random_forest():
    """Train and return Random Forest results."""
    result = processor.run_random_forest()
    return jsonify(result)


@app.route("/api/predict", methods=["POST"])
def api_predict():
    """Predict health risk from user-submitted data."""
    input_data = request.get_json()
    if not input_data:
        return jsonify({"error": "No input data provided"}), 400
    result = processor.predict_risk(input_data)
    return jsonify(result)


@app.route("/api/filter-data")
def api_filter_data():
    """Filter dataset by query parameters."""
    filters = {
        "age_min": request.args.get("age_min", type=int),
        "age_max": request.args.get("age_max", type=int),
        "gender": request.args.get("gender", ""),
        "occupation": request.args.get("occupation", ""),
        "diet_type": request.args.get("diet_type", ""),
    }
    result = processor.filter_data(filters)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)
