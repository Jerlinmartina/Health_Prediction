"""
Health Data Processor — Data cleaning with Pandas/NumPy and ML pipeline with scikit-learn.

Provides:
  - Data loading, cleaning, encoding, scaling
  - K-Means Clustering
  - DBSCAN Clustering
  - PCA Dimensionality Reduction
  - Random Forest Classification (Health Risk Prediction)
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.cluster import KMeans, DBSCAN
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    silhouette_score,
)


class HealthDataProcessor:
    """End-to-end health data processing and ML pipeline."""

    def __init__(self, csv_path: str):
        self.csv_path = csv_path
        self.raw_df = None
        self.cleaned_df = None
        self.encoded_df = None
        self.scaled_data = None
        self.scaler = StandardScaler()
        self.label_encoders: dict[str, LabelEncoder] = {}
        self.feature_names: list[str] = []
        self.categorical_cols = [
            "Gender",
            "Occupation",
            "Diet_Type",
            "Smoking_Status",
            "Alcohol_Consumption",
        ]
        self.numeric_cols: list[str] = []
        self.rf_model = None
        self.rf_accuracy = 0.0
        self.rf_report = {}
        self.rf_confusion = []
        self.rf_feature_importance = []

    # ─── DATA LOADING & CLEANING ─────────────────────────────────────────

    def load_data(self) -> pd.DataFrame:
        """Load CSV data into a Pandas DataFrame."""
        self.raw_df = pd.read_csv(self.csv_path)
        # Drop completely empty rows
        self.raw_df.dropna(how="all", inplace=True)
        self.raw_df.reset_index(drop=True, inplace=True)
        return self.raw_df

    def clean_data(self) -> pd.DataFrame:
        """Clean the dataset using Pandas and NumPy."""
        if self.raw_df is None:
            self.load_data()

        df = self.raw_df.copy()

        # --- Fill missing numeric values with median ---
        self.numeric_cols = [
            col for col in df.columns if col not in self.categorical_cols
        ]
        for col in self.numeric_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            if df[col].isnull().any():
                median_val = np.nanmedian(df[col].values)
                df[col].fillna(median_val, inplace=True)

        # --- Fill missing categorical values with mode ---
        for col in self.categorical_cols:
            if col in df.columns and df[col].isnull().any():
                mode_val = df[col].mode()[0]
                df[col].fillna(mode_val, inplace=True)

        # --- Remove duplicates ---
        df.drop_duplicates(inplace=True)
        df.reset_index(drop=True, inplace=True)

        # --- Outlier capping using IQR (numpy) ---
        for col in self.numeric_cols:
            values = df[col].values
            q1 = np.percentile(values, 25)
            q3 = np.percentile(values, 75)
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            df[col] = np.clip(values, lower, upper)

        self.cleaned_df = df
        return self.cleaned_df

    def encode_data(self) -> pd.DataFrame:
        """Label-encode categorical columns."""
        if self.cleaned_df is None:
            self.clean_data()

        df = self.cleaned_df.copy()

        for col in self.categorical_cols:
            if col in df.columns:
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))
                self.label_encoders[col] = le

        self.encoded_df = df
        self.feature_names = list(df.columns)
        return self.encoded_df

    def scale_data(self) -> np.ndarray:
        """Standardize all features using StandardScaler."""
        if self.encoded_df is None:
            self.encode_data()

        self.scaled_data = self.scaler.fit_transform(self.encoded_df.values)
        return self.scaled_data

    # ─── DERIVED TARGET: HEALTH RISK ─────────────────────────────────────

    def derive_health_risk(self) -> np.ndarray:
        """
        Derive a Health_Risk_Category (0=Low, 1=Medium, 2=High) from
        BMI, Systolic_BP, Cholesterol_Level, and Blood_Glucose using
        percentile-based thresholds.
        """
        if self.cleaned_df is None:
            self.clean_data()

        df = self.cleaned_df
        risk_score = np.zeros(len(df))

        # BMI risk
        bmi = df["BMI"].values
        risk_score += np.where(bmi < 18.5, 1, np.where(bmi > 30, 2, 0))

        # Blood pressure risk
        sbp = df["Systolic_BP"].values
        risk_score += np.where(sbp > 140, 2, np.where(sbp > 130, 1, 0))

        # Cholesterol risk
        chol = df["Cholesterol_Level"].values
        risk_score += np.where(chol > 240, 2, np.where(chol > 200, 1, 0))

        # Blood glucose risk
        gluc = df["Blood_Glucose"].values
        risk_score += np.where(gluc > 125, 2, np.where(gluc > 100, 1, 0))

        # Map to Low/Medium/High
        labels = np.where(risk_score <= 2, 0, np.where(risk_score <= 4, 1, 2))
        return labels

    # ─── DATA SUMMARY ────────────────────────────────────────────────────

    def get_data_summary(self) -> dict:
        """Return comprehensive dataset statistics."""
        if self.cleaned_df is None:
            self.clean_data()

        df = self.cleaned_df
        summary = {
            "total_records": int(len(df)),
            "total_features": int(len(df.columns)),
            "numeric_stats": {},
            "categorical_stats": {},
            "distributions": {},
        }

        # Numeric statistics
        for col in self.numeric_cols:
            values = df[col].values
            summary["numeric_stats"][col] = {
                "mean": round(float(np.mean(values)), 2),
                "median": round(float(np.median(values)), 2),
                "std": round(float(np.std(values)), 2),
                "min": round(float(np.min(values)), 2),
                "max": round(float(np.max(values)), 2),
            }

        # Categorical distributions
        for col in self.categorical_cols:
            if col in df.columns:
                counts = df[col].value_counts().to_dict()
                summary["categorical_stats"][col] = {
                    str(k): int(v) for k, v in counts.items()
                }

        # Age distribution (binned)
        age_bins = [18, 25, 35, 45, 55, 65]
        age_labels = ["18-24", "25-34", "35-44", "45-54", "55-64"]
        df_temp = df.copy()
        df_temp["Age_Group"] = pd.cut(
            df_temp["Age"], bins=age_bins, labels=age_labels, right=False
        )
        summary["distributions"]["age_groups"] = (
            df_temp["Age_Group"].value_counts().sort_index().to_dict()
        )
        summary["distributions"]["age_groups"] = {
            str(k): int(v)
            for k, v in summary["distributions"]["age_groups"].items()
        }

        # BMI distribution
        bmi_bins = [0, 18.5, 25, 30, 50]
        bmi_labels = ["Underweight", "Normal", "Overweight", "Obese"]
        df_temp["BMI_Category"] = pd.cut(
            df_temp["BMI"], bins=bmi_bins, labels=bmi_labels
        )
        summary["distributions"]["bmi_categories"] = (
            df_temp["BMI_Category"].value_counts().to_dict()
        )
        summary["distributions"]["bmi_categories"] = {
            str(k): int(v)
            for k, v in summary["distributions"]["bmi_categories"].items()
        }

        # Health risk distribution
        risk_labels_arr = self.derive_health_risk()
        risk_map = {0: "Low", 1: "Medium", 2: "High"}
        risk_counts = {}
        for val in [0, 1, 2]:
            risk_counts[risk_map[val]] = int(np.sum(risk_labels_arr == val))
        summary["distributions"]["health_risk"] = risk_counts

        return summary

    # ─── K-MEANS CLUSTERING ──────────────────────────────────────────────

    def run_kmeans(self, n_clusters: int = 3) -> dict:
        """Run K-Means clustering and return results."""
        if self.scaled_data is None:
            self.scale_data()

        # Use PCA for 2D visualization
        pca = PCA(n_components=2)
        pca_data = pca.fit_transform(self.scaled_data)

        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(self.scaled_data)

        sil_score = float(silhouette_score(self.scaled_data, labels))

        # Cluster statistics
        cluster_stats = []
        for i in range(n_clusters):
            mask = labels == i
            cluster_stats.append(
                {
                    "cluster": i,
                    "count": int(np.sum(mask)),
                    "center_pc1": round(float(kmeans.cluster_centers_[i][0]), 3),
                    "center_pc2": round(
                        float(kmeans.cluster_centers_[i][1]) if len(kmeans.cluster_centers_[i]) > 1 else 0, 3
                    ),
                }
            )

        return {
            "n_clusters": n_clusters,
            "labels": labels.tolist(),
            "silhouette_score": round(sil_score, 4),
            "cluster_stats": cluster_stats,
            "pca_x": np.round(pca_data[:, 0], 4).tolist(),
            "pca_y": np.round(pca_data[:, 1], 4).tolist(),
            "inertia": round(float(kmeans.inertia_), 2),
        }

    def run_elbow(self, max_k: int = 10) -> dict:
        """Compute inertia for k=2..max_k for elbow method."""
        if self.scaled_data is None:
            self.scale_data()

        inertias = []
        sil_scores = []
        for k in range(2, max_k + 1):
            km = KMeans(n_clusters=k, random_state=42, n_init=10)
            km.fit(self.scaled_data)
            inertias.append(round(float(km.inertia_), 2))
            sil_scores.append(
                round(float(silhouette_score(self.scaled_data, km.labels_)), 4)
            )

        return {
            "k_values": list(range(2, max_k + 1)),
            "inertias": inertias,
            "silhouette_scores": sil_scores,
        }

    # ─── DBSCAN CLUSTERING ───────────────────────────────────────────────

    def run_dbscan(self, eps: float = 0.5, min_samples: int = 5) -> dict:
        """Run DBSCAN clustering on PCA-reduced 2D data and return results."""
        if self.scaled_data is None:
            self.scale_data()

        # Reduce to 2D with PCA first — faster DBSCAN and matches the scatter plot
        pca = PCA(n_components=2)
        pca_data = pca.fit_transform(self.scaled_data)

        dbscan = DBSCAN(eps=eps, min_samples=min_samples, algorithm='ball_tree')
        labels = dbscan.fit_predict(pca_data)

        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = int(np.sum(labels == -1))

        cluster_stats = []
        for i in sorted(set(labels)):
            mask = labels == i
            cluster_stats.append(
                {
                    "cluster": int(i),
                    "label": "Noise" if i == -1 else f"Cluster {i}",
                    "count": int(np.sum(mask)),
                }
            )

        sil = -1.0
        if n_clusters >= 2:
            non_noise = labels != -1
            if np.sum(non_noise) > n_clusters:
                sil = round(
                    float(
                        silhouette_score(
                            pca_data[non_noise], labels[non_noise]
                        )
                    ),
                    4,
                )

        return {
            "eps": eps,
            "min_samples": min_samples,
            "n_clusters": n_clusters,
            "n_noise": n_noise,
            "labels": labels.tolist(),
            "cluster_stats": cluster_stats,
            "silhouette_score": sil,
            "pca_x": np.round(pca_data[:, 0], 4).tolist(),
            "pca_y": np.round(pca_data[:, 1], 4).tolist(),
        }

    # ─── PCA ─────────────────────────────────────────────────────────────

    def run_pca(self, n_components: int = 2) -> dict:
        """Run PCA and return transformed data + explained variance."""
        if self.scaled_data is None:
            self.scale_data()

        pca = PCA(n_components=min(n_components, self.scaled_data.shape[1]))
        transformed = pca.fit_transform(self.scaled_data)

        # Also run PCA with all components for cumulative variance
        pca_full = PCA()
        pca_full.fit(self.scaled_data)

        # Cluster the PCA-reduced data for coloring
        kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(transformed)

        return {
            "n_components": int(pca.n_components_),
            "explained_variance_ratio": np.round(
                pca.explained_variance_ratio_, 4
            ).tolist(),
            "cumulative_variance": np.round(
                np.cumsum(pca_full.explained_variance_ratio_), 4
            ).tolist(),
            "all_variance_ratios": np.round(
                pca_full.explained_variance_ratio_, 4
            ).tolist(),
            "pc1": np.round(transformed[:, 0], 4).tolist(),
            "pc2": np.round(transformed[:, 1], 4).tolist()
            if n_components >= 2
            else [],
            "cluster_labels": cluster_labels.tolist(),
            "feature_names": self.feature_names,
            "loadings": np.round(pca.components_, 4).tolist(),
        }

    # ─── RANDOM FOREST ───────────────────────────────────────────────────

    def run_random_forest(self) -> dict:
        """Train Random Forest classifier on derived health risk labels."""
        if self.encoded_df is None:
            self.encode_data()

        X = self.encoded_df.values
        y = self.derive_health_risk()

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        self.rf_model = RandomForestClassifier(
            n_estimators=100, random_state=42, max_depth=10
        )
        self.rf_model.fit(X_train, y_train)

        y_pred = self.rf_model.predict(X_test)

        self.rf_accuracy = round(float(accuracy_score(y_test, y_pred)), 4)
        report = classification_report(
            y_test,
            y_pred,
            target_names=["Low", "Medium", "High"],
            output_dict=True,
        )
        cm = confusion_matrix(y_test, y_pred)

        # Feature importance
        importances = self.rf_model.feature_importances_
        indices = np.argsort(importances)[::-1]
        self.rf_feature_importance = [
            {
                "feature": self.feature_names[i],
                "importance": round(float(importances[i]), 4),
            }
            for i in indices
        ]

        # Clean report for JSON
        clean_report = {}
        for key, val in report.items():
            if isinstance(val, dict):
                clean_report[key] = {
                    k: round(float(v), 4) for k, v in val.items()
                }
            else:
                clean_report[key] = round(float(val), 4)

        return {
            "accuracy": self.rf_accuracy,
            "classification_report": clean_report,
            "confusion_matrix": cm.tolist(),
            "feature_importance": self.rf_feature_importance,
            "class_names": ["Low", "Medium", "High"],
            "test_size": int(len(y_test)),
            "train_size": int(len(y_train)),
        }

    # ─── PREDICTION ──────────────────────────────────────────────────────

    def predict_risk(self, input_data: dict) -> dict:
        """Predict health risk for user-provided input."""
        if self.rf_model is None:
            self.run_random_forest()

        # Build feature vector in the correct order
        row = []
        for col in self.feature_names:
            if col in self.categorical_cols:
                le = self.label_encoders[col]
                val = input_data.get(col, le.classes_[0])
                if val in le.classes_:
                    row.append(le.transform([val])[0])
                else:
                    row.append(0)
            else:
                row.append(float(input_data.get(col, 0)))

        X_input = np.array([row])
        prediction = int(self.rf_model.predict(X_input)[0])
        probabilities = self.rf_model.predict_proba(X_input)[0]

        risk_map = {0: "Low", 1: "Medium", 2: "High"}

        return {
            "prediction": risk_map[prediction],
            "prediction_code": prediction,
            "probabilities": {
                "Low": round(float(probabilities[0]), 4),
                "Medium": round(float(probabilities[1]), 4),
                "High": round(float(probabilities[2]), 4),
            },
        }

    # ─── FILTER DATA ─────────────────────────────────────────────────────

    def filter_data(self, filters: dict) -> dict:
        """Filter the cleaned dataset based on criteria."""
        if self.cleaned_df is None:
            self.clean_data()

        df = self.cleaned_df.copy()

        if "age_min" in filters and filters["age_min"] is not None:
            df = df[df["Age"] >= int(filters["age_min"])]
        if "age_max" in filters and filters["age_max"] is not None:
            df = df[df["Age"] <= int(filters["age_max"])]
        if "gender" in filters and filters["gender"]:
            df = df[df["Gender"] == filters["gender"]]
        if "occupation" in filters and filters["occupation"]:
            df = df[df["Occupation"] == filters["occupation"]]
        if "diet_type" in filters and filters["diet_type"]:
            df = df[df["Diet_Type"] == filters["diet_type"]]

        # Summary of filtered data
        result = {
            "total_records": int(len(df)),
            "avg_bmi": round(float(df["BMI"].mean()), 2) if len(df) > 0 else 0,
            "avg_heart_rate": round(float(df["Resting_Heart_Rate"].mean()), 2)
            if len(df) > 0
            else 0,
            "avg_sleep": round(float(df["Sleep_Hours_Per_Day"].mean()), 2)
            if len(df) > 0
            else 0,
            "avg_steps": round(float(df["Steps_Per_Day"].mean()), 2)
            if len(df) > 0
            else 0,
            "avg_calories": round(float(df["Calories_Per_Day"].mean()), 2)
            if len(df) > 0
            else 0,
            "avg_stress": round(float(df["Stress_Level"].mean()), 2)
            if len(df) > 0
            else 0,
            "bmi_values": df["BMI"].values.tolist()[:200],
            "exercise_values": df["Exercise_Hours_Per_Week"].values.tolist()[:200],
            "sleep_values": df["Sleep_Hours_Per_Day"].values.tolist()[:200],
            "stress_values": df["Stress_Level"].values.tolist()[:200],
        }

        return result
