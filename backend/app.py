from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
import os
import time

import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

DATASET_NAME = "World Development Indicators (WDI)"
PROVIDER = "World Bank Open Data"
WORLD_BANK_URLS = [
    "http://api.worldbank.org/v2/country/{country}/indicator/{indicator}",
    "https://api.worldbank.org/v2/country/{country}/indicator/{indicator}",
]
WORLD_BANK_RETRIES = 4
REST_COUNTRIES_URL = "https://api.restcountries.com/countries/v5/codes.alpha_3/{country}"
REST_COUNTRIES_TIMEOUT = 10
REST_COUNTRIES_RETRIES = 3
FORECAST_YEARS = 5
MAX_FEATURE_MISSING_RATIO = 0.6
MAX_ROW_MISSING_RATIO = 0.5
MIN_ML_ROWS = 10
MIN_ML_FEATURES = 2
YEAR_FEATURE = "__year"
TARGET_LAG_FEATURE = "__target_lag1"

POPULATION_TARGET = "SP.POP.TOTL"
GDP_TARGET = "NY.GDP.PCAP.CD"

POPULATION_FEATURES: dict[str, str] = {
    "SP.POP.GROW": "Population growth annual %",
    "SP.DYN.TFRT.IN": "Fertility rate",
    "SP.DYN.CBRT.IN": "Birth rate",
    "SP.DYN.CDRT.IN": "Death rate",
    "SP.DYN.LE00.IN": "Life expectancy at birth",
    "SM.POP.NETM": "Net migration",
    "SP.URB.TOTL.IN.ZS": "Urban population %",
    "EN.POP.DNST": "Population density",
}

GDP_FEATURES: dict[str, str] = {
    "NY.GDP.MKTP.KD.ZG": "GDP growth annual %",
    "FP.CPI.TOTL.ZG": "Inflation annual %",
    "SL.UEM.TOTL.ZS": "Unemployment %",
    "NE.TRD.GNFS.ZS": "Trade % of GDP",
    "BX.KLT.DINV.WD.GD.ZS": "FDI net inflows % of GDP",
    "IT.NET.USER.ZS": "Individuals using the Internet %",
    "SE.XPD.TOTL.GD.ZS": "Government education expenditure % of GDP",
    "SP.URB.TOTL.IN.ZS": "Urban population %",
    "SP.DYN.LE00.IN": "Life expectancy at birth",
}

TARGET_LABELS = {
    POPULATION_TARGET: "Population, total",
    GDP_TARGET: "GDP per capita",
}

app = FastAPI(
    title="Urban Analytics WDI Prediction API",
    description="Machine learning forecasts using World Bank World Development Indicators.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@dataclass
class PreparedData:
    frame: pd.DataFrame
    target: str
    features: list[str]
    dropped_features: list[str]
    warnings: list[str]
    coverage: dict[str, Any]


def safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric if np.isfinite(numeric) else None


@lru_cache(maxsize=1024)
def fetch_indicator(country: str, indicator: str) -> tuple[tuple[int, float], ...]:
    """Fetch one WDI indicator.

    WDI was selected because it provides globally comparable public indicators
    for demographic, economic, education, technology, migration, and health
    signals. The API is free and does not require authentication.
    """
    last_error: requests.RequestException | None = None
    response: requests.Response | None = None

    for url_template in WORLD_BANK_URLS:
        url = url_template.format(country=country.lower(), indicator=indicator)
        for attempt in range(1, WORLD_BANK_RETRIES + 1):
            try:
                response = requests.get(
                    url,
                    params={"format": "json", "per_page": 20000},
                    timeout=30,
                    headers={"User-Agent": "urban-analytics-wdi-ml/1.0"},
                )
                response.raise_for_status()
                break
            except requests.RequestException as exc:
                last_error = exc
                response = None
                if attempt < WORLD_BANK_RETRIES:
                    time.sleep(0.75 * attempt)
        if response is not None:
            break

    if response is None:
        if last_error is not None:
            raise last_error
        raise requests.RequestException(f"World Bank returned no response for {indicator}")
    response.raise_for_status()
    payload = response.json()
    rows = payload[1] if isinstance(payload, list) and len(payload) > 1 else []
    points: list[tuple[int, float]] = []

    for row in rows:
        year = row.get("date")
        value = safe_float(row.get("value"))
        if year is None or value is None:
            continue
        try:
            points.append((int(year), value))
        except ValueError:
            continue

    return tuple(sorted(points, key=lambda item: item[0]))


def build_indicator_frame(country: str, indicators: list[str]) -> pd.DataFrame:
    series_by_indicator: dict[str, pd.Series] = {}
    target_indicator = indicators[0]
    target_points = fetch_indicator(country, target_indicator)

    if not target_points:
        series_by_indicator[target_indicator] = pd.Series(dtype=float)
    else:
        series_by_indicator[target_indicator] = pd.Series(
            {year: value for year, value in target_points},
            dtype=float,
        )

    optional_indicators = indicators[1:]

    # Fetch WDI indicators concurrently. First-time uncached requests may need
    # many World Bank API calls, so serial fetching can make the dashboard look
    # stuck even when the backend is working correctly.
    with ThreadPoolExecutor(max_workers=min(8, len(optional_indicators) or 1)) as executor:
        futures = {
            executor.submit(fetch_indicator, country, indicator): indicator
            for indicator in optional_indicators
        }
        for future in as_completed(futures):
            indicator = futures[future]
            try:
                points = future.result()
            except requests.RequestException:
                points = ()
            if not points:
                series_by_indicator[indicator] = pd.Series(dtype=float)
                continue
            series_by_indicator[indicator] = pd.Series(
                {year: value for year, value in points},
                dtype=float,
            )

    frame = pd.DataFrame(series_by_indicator)
    frame.index.name = "year"
    frame = frame.sort_index()
    return frame


def prepare_data(
    country: str,
    target: str,
    feature_map: dict[str, str],
) -> PreparedData:
    indicators = [target, *feature_map.keys()]
    raw = build_indicator_frame(country, indicators)
    warnings: list[str] = []

    if raw.empty or target not in raw.columns or raw[target].dropna().shape[0] < 2:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough WDI target data for {country.upper()} and {target}.",
        )

    raw = raw.loc[raw[target].notna()].copy()
    candidate_features = list(feature_map.keys())
    dropped_features: list[str] = []
    available_features: list[str] = []

    # Missingness is evaluated per feature. Very sparse indicators are dropped
    # instead of being imputed aggressively, which keeps the model defensible.
    for feature in candidate_features:
        missing_ratio = raw[feature].isna().mean() if feature in raw.columns else 1.0
        if feature not in raw.columns or missing_ratio > MAX_FEATURE_MISSING_RATIO:
            dropped_features.append(feature)
            warnings.append(
                f"Dropped {feature} ({feature_map[feature]}) due to {missing_ratio:.0%} missing values."
            )
        else:
            available_features.append(feature)

    if not available_features:
        warnings.append("No optional WDI features had enough coverage; using trend fallback.")

    feature_frame = raw[[target, *available_features]].copy()
    row_missing_ratio = feature_frame[available_features].isna().mean(axis=1) if available_features else pd.Series(0, index=feature_frame.index)
    before_rows = len(feature_frame)
    feature_frame = feature_frame.loc[row_missing_ratio <= MAX_ROW_MISSING_RATIO].copy()
    dropped_years = before_rows - len(feature_frame)

    if dropped_years > 0:
        warnings.append(f"Dropped {dropped_years} years because too many feature values were missing.")

    if available_features:
        # Short gaps are imputed with nearby values. This is reasonable for WDI
        # annual country indicators, but sparse columns have already been removed.
        feature_frame[available_features] = feature_frame[available_features].ffill(limit=2).bfill(limit=2)
        usable_features = [feature for feature in available_features if feature_frame[feature].notna().sum() >= 2]
    else:
        usable_features = []

    for feature in available_features:
        if feature not in usable_features:
            dropped_features.append(feature)
            warnings.append(f"Dropped {feature} after imputation because it still had insufficient data.")

    feature_frame = feature_frame[[target, *usable_features]].dropna(subset=[target])
    if usable_features:
        feature_frame = feature_frame.dropna(subset=usable_features, how="any")

    # Engineered features keep ML forecasts anchored to the latest actual
    # target value. This avoids a common problem where macro indicators alone
    # predict a sharp drop even though the target has been steadily increasing.
    feature_frame[YEAR_FEATURE] = feature_frame.index.astype(float)
    feature_frame[TARGET_LAG_FEATURE] = feature_frame[target].shift(1).bfill()

    coverage = {
        "first_year": int(feature_frame.index.min()),
        "latest_year": int(feature_frame.index.max()),
        "target_years_available": int(raw[target].notna().sum()),
        "usable_training_rows": int(len(feature_frame)),
        "features_requested": len(candidate_features),
        "features_used": len(usable_features),
        "features_dropped": len(set(dropped_features)),
    }

    if len(feature_frame) < MIN_ML_ROWS:
        warnings.append(
            f"Only {len(feature_frame)} usable rows are available; ML models may fall back to trend forecasting."
        )
    if len(usable_features) < MIN_ML_FEATURES:
        warnings.append(
            f"Only {len(usable_features)} usable WDI features are available; engineered year and lag features will be used where possible."
        )

    return PreparedData(
        frame=feature_frame,
        target=target,
        features=usable_features,
        dropped_features=sorted(set(dropped_features)),
        warnings=warnings,
        coverage=coverage,
    )


def trend_predictor(years: np.ndarray, values: np.ndarray):
    """Fallback trend model for weak WDI coverage.

    It uses log-linear growth so forecasts are non-negative and more stable
    than raw linear extrapolation for population and GDP per capita.
    """
    values = np.maximum(values.astype(float), 1e-9)
    shifted_years = years.astype(float) - float(years.min())
    model = LinearRegression()
    model.fit(shifted_years.reshape(-1, 1), np.log(values))

    def predict(target_years: np.ndarray) -> np.ndarray:
        shifted = target_years.astype(float) - float(years.min())
        return np.exp(model.predict(shifted.reshape(-1, 1)))

    fitted = predict(years)
    return "Log-linear trend fallback", predict, fitted


def extrapolate_feature(years: np.ndarray, values: np.ndarray, future_years: list[int]) -> np.ndarray:
    valid = np.isfinite(values)
    if valid.sum() < 2:
        fallback = values[valid][-1] if valid.any() else 0.0
        return np.full(len(future_years), fallback)

    x = years[valid].astype(float)
    y = values[valid].astype(float)
    shifted = x - x.min()
    model = LinearRegression()
    model.fit(shifted.reshape(-1, 1), y)
    future_shifted = np.array(future_years, dtype=float) - x.min()
    predictions = model.predict(future_shifted.reshape(-1, 1))

    lower = np.nanpercentile(y, 1)
    upper = np.nanpercentile(y, 99)
    spread = max(upper - lower, abs(upper), 1.0)
    return np.clip(predictions, lower - spread, upper + spread)


def train_and_forecast(prepared: PreparedData) -> dict[str, Any]:
    frame = prepared.frame.copy()
    target = prepared.target
    years = frame.index.to_numpy(dtype=int)
    target_values = frame[target].to_numpy(dtype=float)
    latest_year = int(years[-1])
    future_years = [latest_year + offset for offset in range(1, FORECAST_YEARS + 1)]
    warnings = list(prepared.warnings)
    engineered_features = [YEAR_FEATURE, TARGET_LAG_FEATURE]
    model_features = [*prepared.features, *engineered_features]

    use_ml = len(frame) >= MIN_ML_ROWS and len(model_features) >= MIN_ML_FEATURES

    if not use_ml:
        model_name, predictor, fitted = trend_predictor(years, target_values)
        future_values = predictor(np.array(future_years, dtype=int))
        mae = mean_absolute_error(target_values, fitted)
        rmse = float(np.sqrt(mean_squared_error(target_values, fitted)))
        r2 = r2_score(target_values, fitted) if len(target_values) > 1 else None
        selected_features: list[str] = []
    else:
        X = frame[model_features].to_numpy(dtype=float)
        y = target_values
        holdout_size = min(5, max(2, int(round(len(frame) * 0.2))))
        train_end = len(frame) - holdout_size
        X_train, X_test = X[:train_end], X[train_end:]
        y_train, y_test = y[:train_end], y[train_end:]

        baseline = LinearRegression()
        forest = RandomForestRegressor(
            n_estimators=350,
            min_samples_leaf=2,
            random_state=42,
        )
        baseline.fit(X_train, y_train)
        forest.fit(X_train, y_train)

        candidates = [
            ("Linear Regression baseline", baseline),
            ("Random Forest Regressor", forest),
        ]
        scored: list[tuple[str, Any, float, float, float | None]] = []
        for name, model in candidates:
            pred = model.predict(X_test)
            mae_value = mean_absolute_error(y_test, pred)
            rmse_value = float(np.sqrt(mean_squared_error(y_test, pred)))
            r2_value = r2_score(y_test, pred) if len(y_test) > 1 else None
            scored.append((name, model, mae_value, rmse_value, r2_value))

        name, selected_model, mae, rmse, r2 = sorted(scored, key=lambda item: item[3])[0]
        selected_model.fit(X, y)
        model_name = name
        selected_features = model_features

        extrapolated_features: dict[str, np.ndarray] = {}
        for feature in prepared.features:
            extrapolated_features[feature] = extrapolate_feature(
                years,
                frame[feature].to_numpy(dtype=float),
                future_years,
            )
        future_values_list: list[float] = []
        previous_target = float(target_values[-1])
        for index, future_year in enumerate(future_years):
            row = {
                feature: float(extrapolated_features[feature][index])
                for feature in prepared.features
            }
            row[YEAR_FEATURE] = float(future_year)
            row[TARGET_LAG_FEATURE] = previous_target
            prediction = float(
                selected_model.predict(
                    pd.DataFrame([row])[model_features].to_numpy(dtype=float)
                )[0]
            )
            prediction = max(prediction, 0.0)
            future_values_list.append(prediction)
            previous_target = prediction

        future_values = np.array(future_values_list, dtype=float)

        recent_growth_rates = [
            np.log(target_values[index] / target_values[index - 1])
            for index in range(max(1, len(target_values) - 5), len(target_values))
            if target_values[index - 1] > 0 and target_values[index] > 0
        ]
        recent_growth = float(np.median(recent_growth_rates)) if recent_growth_rates else 0.0
        if recent_growth > 0 and future_values[-1] < target_values[-1]:
            fallback_name, fallback_predictor, _ = trend_predictor(years, target_values)
            fallback_values = fallback_predictor(np.array(future_years, dtype=int))
            future_values = np.maximum(future_values, fallback_values)
            warnings.append(
                f"Applied continuity guard because the selected ML forecast reversed a positive recent trend; blended with {fallback_name}."
            )

        annual_cap = 0.015 if target == POPULATION_TARGET else 0.05
        capped_values: list[float] = []
        for index, value in enumerate(future_values, start=1):
            upper = target_values[-1] * np.exp(annual_cap * index)
            lower = target_values[-1] * np.exp(-annual_cap * index)
            capped_values.append(float(np.clip(value, lower, upper)))
        if not np.allclose(future_values, capped_values):
            warnings.append(
                f"Applied forecast range cap of {annual_cap:.0%} per year to avoid implausible short-term jumps."
            )
        future_values = np.array(capped_values, dtype=float)

        if model_name == "Linear Regression baseline":
            warnings.append("Linear Regression outperformed Random Forest on recent holdout years for this country.")

    future_values = np.maximum(np.asarray(future_values, dtype=float), 0)
    latest_actual = float(target_values[-1])
    predicted_after_5 = float(future_values[-1])
    growth_percentage = ((predicted_after_5 - latest_actual) / latest_actual * 100) if latest_actual else None

    historical = [
        {"year": int(year), "value": float(value)}
        for year, value in zip(years, target_values)
    ]
    forecast = [
        {"year": int(year), "value": float(value)}
        for year, value in zip(future_years, future_values)
    ]

    return {
        "dataset_name": DATASET_NAME,
        "provider": PROVIDER,
        "target_indicator": target,
        "target_label": TARGET_LABELS[target],
        "model_used": model_name,
        "features_used": selected_features,
        "features_dropped": prepared.dropped_features,
        "missing_data_warnings": warnings,
        "historical_actual_data": historical,
        "predicted_future_data": forecast,
        "latest_actual_value": latest_actual,
        "predicted_value_after_5_years": predicted_after_5,
        "growth_percentage": growth_percentage,
        "mae": float(mae) if mae is not None else None,
        "rmse": float(rmse) if rmse is not None else None,
        "r2_score": float(r2) if r2 is not None and np.isfinite(r2) else None,
        "training_years_used": int(prepared.coverage["usable_training_rows"]),
        "data_coverage_summary": prepared.coverage,
    }


def predict(country: str, target: str, features: dict[str, str]) -> dict[str, Any]:
    country_code = country.upper()
    try:
        prepared = prepare_data(country_code, target, features)
        result = train_and_forecast(prepared)
    except requests.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"World Bank API request failed: {exc}") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"World Bank API is unavailable: {exc}") from exc

    return {
        "country_code": country_code,
        **result,
    }


@lru_cache(maxsize=256)
def cached_predict_population(country_code: str) -> dict[str, Any]:
    return predict(country_code, POPULATION_TARGET, POPULATION_FEATURES)


@lru_cache(maxsize=256)
def cached_predict_gdp(country_code: str) -> dict[str, Any]:
    return predict(country_code, GDP_TARGET, GDP_FEATURES)


@lru_cache(maxsize=256)
def fetch_rest_country(country_code: str) -> Any:
    country = country_code.upper()
    api_key = os.getenv("REST_COUNTRIES_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="REST_COUNTRIES_API_KEY is not configured for the REST Countries v5 API.",
        )

    url = REST_COUNTRIES_URL.format(country=country)
    last_error: requests.RequestException | None = None
    response: requests.Response | None = None

    for attempt in range(1, REST_COUNTRIES_RETRIES + 1):
        try:
            response = requests.get(
                url,
                timeout=REST_COUNTRIES_TIMEOUT,
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "Connection": "close",
                    "User-Agent": "urban-analytics-country-proxy/1.0",
                },
            )
            break
        except requests.RequestException as exc:
            last_error = exc
            if attempt < REST_COUNTRIES_RETRIES:
                time.sleep(0.75 * attempt)

    if response is None:
        if isinstance(last_error, requests.Timeout):
            raise HTTPException(
                status_code=504,
                detail=f"REST Countries request timed out for {country}.",
            ) from last_error
        raise HTTPException(
            status_code=502,
            detail=f"REST Countries API is unavailable after {REST_COUNTRIES_RETRIES} attempts: {last_error}",
        ) from last_error

    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail=f"Country profile not found for {country}.",
        )
    if not response.ok:
        raise HTTPException(
            status_code=502,
            detail=(
                "REST Countries API request failed with "
                f"HTTP {response.status_code}."
            ),
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="REST Countries API returned invalid JSON.",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=502,
            detail="REST Countries API returned an unexpected response.",
        )
    if "errors" in payload:
        errors = payload.get("errors")
        message = "REST Countries API request failed."
        if isinstance(errors, list) and errors and isinstance(errors[0], dict):
            message = str(errors[0].get("message") or message)
        raise HTTPException(status_code=502, detail=message)

    objects = payload.get("data", {}).get("objects")
    if not isinstance(objects, list) or not objects:
        raise HTTPException(
            status_code=404,
            detail=f"Country profile not found for {country}.",
        )

    return [to_rest_country_v3_shape(item) for item in objects]


def to_rest_country_v3_shape(country: dict[str, Any]) -> dict[str, Any]:
    names = country.get("names") if isinstance(country.get("names"), dict) else {}
    codes = country.get("codes") if isinstance(country.get("codes"), dict) else {}
    area = country.get("area") if isinstance(country.get("area"), dict) else {}
    flag = country.get("flag") if isinstance(country.get("flag"), dict) else {}
    capitals = country.get("capitals")
    capital_names = [
        item.get("name")
        for item in capitals
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    ] if isinstance(capitals, list) else None

    return {
        "name": {
            "common": names.get("common"),
            "official": names.get("official"),
        },
        "cca2": codes.get("alpha_2"),
        "cca3": codes.get("alpha_3"),
        "cioc": codes.get("cioc"),
        "capital": capital_names,
        "region": country.get("region"),
        "subregion": country.get("subregion"),
        "population": country.get("population"),
        "area": area.get("kilometers"),
        "flags": {
            "png": flag.get("url_png"),
            "svg": flag.get("url_svg"),
        },
        "borders": country.get("borders"),
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "dataset_name": DATASET_NAME,
        "provider": PROVIDER,
    }


@app.get("/country/{country_code}")
def country(country_code: str) -> Any:
    return fetch_rest_country(country_code)


@app.get("/predict/population/{country_code}")
def predict_population(country_code: str) -> dict[str, Any]:
    return cached_predict_population(country_code.upper())


@app.get("/predict/gdp/{country_code}")
def predict_gdp(country_code: str) -> dict[str, Any]:
    return cached_predict_gdp(country_code.upper())


@app.get("/predict/all/{country_code}")
def predict_all(country_code: str) -> dict[str, Any]:
    # Population and GDP models are independent, so train them concurrently.
    # This cuts first-load latency for the dashboard Predictions tab.
    with ThreadPoolExecutor(max_workers=2) as executor:
        population_future = executor.submit(
            cached_predict_population,
            country_code.upper(),
        )
        gdp_future = executor.submit(
            cached_predict_gdp,
            country_code.upper(),
        )

    return {
        "country_code": country_code.upper(),
        "dataset_name": DATASET_NAME,
        "provider": PROVIDER,
        "population": population_future.result(),
        "gdp": gdp_future.result(),
    }
