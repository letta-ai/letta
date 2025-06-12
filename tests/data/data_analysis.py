#!/usr/bin/env python3
"""
Data Analysis Module - Advanced statistical and machine learning operations
Contains various data processing and analysis functions for research purposes.
"""

import warnings
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Dict, Optional

import numpy as np
import pandas as pd


class AnalysisType(Enum):
    """Enumeration of different analysis types."""

    DESCRIPTIVE = "descriptive"
    CORRELATION = "correlation"
    REGRESSION = "regression"
    CLUSTERING = "clustering"
    TIME_SERIES = "time_series"


@dataclass
class AnalysisResult:
    """Container for analysis results."""

    analysis_type: AnalysisType
    timestamp: datetime
    metrics: Dict[str, float]
    metadata: Dict[str, any]
    success: bool = True
    error_message: Optional[str] = None


class DataPreprocessor:
    """
    Advanced data preprocessing utility class.
    Handles cleaning, transformation, and feature engineering.
    """

    def __init__(self, missing_threshold: float = 0.5):
        self.missing_threshold = missing_threshold
        self.transformations_applied = []

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Comprehensive data cleaning pipeline.

        Args:
            df: Input DataFrame to clean

        Returns:
            Cleaned DataFrame
        """
        original_shape = df.shape

        # Remove columns with excessive missing values
        missing_ratios = df.isnull().sum() / len(df)
        cols_to_drop = missing_ratios[missing_ratios > self.missing_threshold].index
        df_cleaned = df.drop(columns=cols_to_drop)

        if len(cols_to_drop) > 0:
            self.transformations_applied.append(f"Dropped {len(cols_to_drop)} columns")

        # Handle remaining missing values
        numeric_cols = df_cleaned.select_dtypes(include=[np.number]).columns
        categorical_cols = df_cleaned.select_dtypes(include=["object"]).columns

        # Fill numeric missing values with median
        for col in numeric_cols:
            if df_cleaned[col].isnull().any():
                median_value = df_cleaned[col].median()
                df_cleaned[col].fillna(median_value, inplace=True)
                self.transformations_applied.append(f"Filled {col} with median")

        # Fill categorical missing values with mode
        for col in categorical_cols:
            if df_cleaned[col].isnull().any():
                mode_value = df_cleaned[col].mode().iloc[0] if not df_cleaned[col].mode().empty else "Unknown"
                df_cleaned[col].fillna(mode_value, inplace=True)
                self.transformations_applied.append(f"Filled {col} with mode")

        # Remove duplicates
        initial_rows = len(df_cleaned)
        df_cleaned = df_cleaned.drop_duplicates()
        duplicates_removed = initial_rows - len(df_cleaned)

        if duplicates_removed > 0:
            self.transformations_applied.append(f"Removed {duplicates_removed} duplicate rows")

        print(f"Data cleaning complete: {original_shape} -> {df_cleaned.shape}")
        return df_cleaned

    def engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Create new features from existing data.

        Args:
            df: Input DataFrame

        Returns:
            DataFrame with engineered features
        """
        df_featured = df.copy()

        # Numeric feature engineering
        numeric_cols = df_featured.select_dtypes(include=[np.number]).columns

        if len(numeric_cols) >= 2:
            # Create interaction features
            for i, col1 in enumerate(numeric_cols):
                for col2 in numeric_cols[i + 1 :]:
                    df_featured[f"{col1}_{col2}_ratio"] = df_featured[col1] / (df_featured[col2] + 1e-8)
                    df_featured[f"{col1}_{col2}_sum"] = df_featured[col1] + df_featured[col2]

            self.transformations_applied.append("Created interaction features")

        # Binning continuous variables
        for col in numeric_cols:
            if df_featured[col].nunique() > 10:  # Only bin if many unique values
                df_featured[f"{col}_binned"] = pd.qcut(df_featured[col], q=5, labels=False, duplicates="drop")
                self.transformations_applied.append(f"Binned {col}")

        return df_featured


class StatisticalAnalyzer:
    """
    Statistical analysis and hypothesis testing utilities.
    """

    @staticmethod
    def descriptive_statistics(df: pd.DataFrame) -> AnalysisResult:
        """
        Calculate comprehensive descriptive statistics.

        Args:
            df: Input DataFrame

        Returns:
            AnalysisResult with descriptive metrics
        """
        try:
            numeric_df = df.select_dtypes(include=[np.number])

            if numeric_df.empty:
                return AnalysisResult(
                    analysis_type=AnalysisType.DESCRIPTIVE,
                    timestamp=datetime.now(),
                    metrics={},
                    metadata={},
                    success=False,
                    error_message="No numeric columns found",
                )

            metrics = {
                "mean_values": numeric_df.mean().to_dict(),
                "std_values": numeric_df.std().to_dict(),
                "median_values": numeric_df.median().to_dict(),
                "skewness": numeric_df.skew().to_dict(),
                "kurtosis": numeric_df.kurtosis().to_dict(),
                "correlation_with_target": None,  # Would need target column
            }

            metadata = {
                "total_rows": len(df),
                "total_columns": len(df.columns),
                "numeric_columns": len(numeric_df.columns),
                "missing_values": df.isnull().sum().to_dict(),
            }

            return AnalysisResult(analysis_type=AnalysisType.DESCRIPTIVE, timestamp=datetime.now(), metrics=metrics, metadata=metadata)

        except Exception as e:
            return AnalysisResult(
                analysis_type=AnalysisType.DESCRIPTIVE,
                timestamp=datetime.now(),
                metrics={},
                metadata={},
                success=False,
                error_message=str(e),
            )

    @staticmethod
    def correlation_analysis(df: pd.DataFrame, method: str = "pearson") -> AnalysisResult:
        """
        Perform correlation analysis between variables.

        Args:
            df: Input DataFrame
            method: Correlation method ('pearson', 'spearman', 'kendall')

        Returns:
            AnalysisResult with correlation metrics
        """
        try:
            numeric_df = df.select_dtypes(include=[np.number])

            if len(numeric_df.columns) < 2:
                return AnalysisResult(
                    analysis_type=AnalysisType.CORRELATION,
                    timestamp=datetime.now(),
                    metrics={},
                    metadata={},
                    success=False,
                    error_message="Need at least 2 numeric columns for correlation",
                )

            corr_matrix = numeric_df.corr(method=method)

            # Find highest correlations (excluding diagonal)
            corr_pairs = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i + 1, len(corr_matrix.columns)):
                    col1, col2 = corr_matrix.columns[i], corr_matrix.columns[j]
                    corr_value = corr_matrix.iloc[i, j]
                    if not np.isnan(corr_value):
                        corr_pairs.append((col1, col2, abs(corr_value)))

            # Sort by correlation strength
            corr_pairs.sort(key=lambda x: x[2], reverse=True)

            metrics = {
                "correlation_matrix": corr_matrix.to_dict(),
                "highest_correlations": corr_pairs[:10],  # Top 10
                "method_used": method,
            }

            metadata = {"variables_analyzed": list(numeric_df.columns), "total_pairs": len(corr_pairs)}

            return AnalysisResult(analysis_type=AnalysisType.CORRELATION, timestamp=datetime.now(), metrics=metrics, metadata=metadata)

        except Exception as e:
            return AnalysisResult(
                analysis_type=AnalysisType.CORRELATION,
                timestamp=datetime.now(),
                metrics={},
                metadata={},
                success=False,
                error_message=str(e),
            )


class TimeSeriesAnalyzer:
    """
    Time series analysis and forecasting utilities.
    """

    def __init__(self, frequency: str = "D"):
        self.frequency = frequency
        self.models_fitted = {}

    def detect_seasonality(self, series: pd.Series) -> Dict[str, any]:
        """
        Detect seasonal patterns in time series data.

        Args:
            series: Time series data

        Returns:
            Dictionary with seasonality information
        """
        try:
            # Simple seasonality detection using autocorrelation
            autocorr_values = []
            for lag in range(1, min(len(series) // 2, 365)):
                if len(series) > lag:
                    autocorr = series.autocorr(lag=lag)
                    if not np.isnan(autocorr):
                        autocorr_values.append((lag, autocorr))

            # Find peaks in autocorrelation
            significant_lags = [(lag, corr) for lag, corr in autocorr_values if abs(corr) > 0.5]
            significant_lags.sort(key=lambda x: abs(x[1]), reverse=True)

            return {
                "seasonal_lags": significant_lags[:5],
                "strongest_seasonality": significant_lags[0] if significant_lags else None,
                "autocorrelation_values": autocorr_values,
            }

        except Exception as e:
            warnings.warn(f"Seasonality detection failed: {e}")
            return {"error": str(e)}

    def trend_analysis(self, series: pd.Series, window: int = 30) -> Dict[str, any]:
        """
        Analyze trend patterns in time series.

        Args:
            series: Time series data
            window: Rolling window size for trend calculation

        Returns:
            Dictionary with trend information
        """
        try:
            # Calculate rolling statistics
            rolling_mean = series.rolling(window=window).mean()
            rolling_std = series.rolling(window=window).std()

            # Simple trend detection
            first_third = rolling_mean.iloc[: len(rolling_mean) // 3].mean()
            last_third = rolling_mean.iloc[-len(rolling_mean) // 3 :].mean()

            trend_direction = "increasing" if last_third > first_third else "decreasing"
            trend_strength = abs(last_third - first_third) / first_third if first_third != 0 else 0

            return {
                "trend_direction": trend_direction,
                "trend_strength": trend_strength,
                "rolling_mean": rolling_mean.to_dict(),
                "rolling_std": rolling_std.to_dict(),
                "volatility": rolling_std.mean(),
            }

        except Exception as e:
            warnings.warn(f"Trend analysis failed: {e}")
            return {"error": str(e)}


def generate_sample_data(n_samples: int = 1000) -> pd.DataFrame:
    """
    Generate sample dataset for testing analysis functions.

    Args:
        n_samples: Number of samples to generate

    Returns:
        Sample DataFrame
    """
    np.random.seed(42)

    data = {
        "feature_1": np.random.normal(100, 15, n_samples),
        "feature_2": np.random.exponential(2, n_samples),
        "feature_3": np.random.uniform(0, 100, n_samples),
        "category": np.random.choice(["A", "B", "C"], n_samples),
        "timestamp": pd.date_range("2023-01-01", periods=n_samples, freq="D"),
    }

    # Add some correlation
    data["feature_4"] = data["feature_1"] * 0.7 + np.random.normal(0, 10, n_samples)

    # Add missing values
    missing_indices = np.random.choice(n_samples, size=int(0.05 * n_samples), replace=False)
    for idx in missing_indices:
        col = np.random.choice(["feature_1", "feature_2", "feature_3"])
        data[col][idx] = np.nan

    return pd.DataFrame(data)


def main():
    """
    Demonstration of the data analysis pipeline.
    """
    print("=== Data Analysis Pipeline Demo ===")

    # Generate sample data
    df = generate_sample_data(1000)
    print(f"Generated dataset with shape: {df.shape}")

    # Data preprocessing
    preprocessor = DataPreprocessor(missing_threshold=0.1)
    df_clean = preprocessor.clean_data(df)
    df_featured = preprocessor.engineer_features(df_clean)

    print(f"Applied transformations: {preprocessor.transformations_applied}")

    # Statistical analysis
    analyzer = StatisticalAnalyzer()

    # Descriptive statistics
    desc_result = analyzer.descriptive_statistics(df_featured)
    if desc_result.success:
        print(f"Descriptive analysis completed at {desc_result.timestamp}")
        print(f"Analyzed {desc_result.metadata['numeric_columns']} numeric columns")

    # Correlation analysis
    corr_result = analyzer.correlation_analysis(df_featured)
    if corr_result.success:
        print(f"Correlation analysis completed")
        print(f"Found {len(corr_result.metrics['highest_correlations'])} significant correlations")

    # Time series analysis
    ts_analyzer = TimeSeriesAnalyzer()
    time_series = df_clean.set_index("timestamp")["feature_1"]

    ts_analyzer.detect_seasonality(time_series)
    trend = ts_analyzer.trend_analysis(time_series)

    print(f"Time series trend: {trend.get('trend_direction', 'unknown')}")
    print(f"Volatility: {trend.get('volatility', 0):.2f}")


if __name__ == "__main__":
    main()
