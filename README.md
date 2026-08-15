# Urban Analytics Platform

A geospatial urban analytics platform for exploring country-level demographics, economic indicators, safety signals, and five-year forecasts through an interactive 3D globe and dashboard interface.

Tech stack: Vite, React 18, TypeScript, TailwindCSS, Zustand, TanStack React Query, Recharts, Globe.gl, MapLibre GL, Deck.gl, FastAPI, pandas, numpy, and scikit-learn.

---

## Features

- Interactive 3D globe for country selection.
- Country-level analytics dashboard with dark-themed cards, tabs, and charts.
- Population analytics using REST Countries and World Bank data.
- Urbanization trend analysis using World Bank indicators.
- GDP per capita analytics using World Bank historical data.
- Crime and safety analytics using global World Bank indicators.
- Great Britain street incident sampling using the UK Police API when available.
- Predictions tab for five-year population and GDP per capita forecasts.
- FastAPI machine learning backend using World Bank World Development Indicators.
- Model evaluation with MAE, RMSE, R2, and number of training years.
- Public API based data fetching with a local backend proxy for authenticated country metadata.
- Local-first texture assets for globe rendering (avoids remote CORS texture failures).

---

## Dashboard Tabs

- Overview: headline KPIs and core trend charts.
- Population: population trend, country profile, area, density, region, and subregion.
- Economy: GDP per capita and urbanization trends.
- Crime & Safety: global homicide rate, informal payments to officials, and local UK incident data where available.
- Predictions: five-year forecasts for population and GDP per capita.

---

## Predictions Feature

The Predictions tab forecasts:

1. Population growth.
2. GDP per capita growth.

The main prediction path uses a Python FastAPI backend that fetches World Bank World Development Indicators directly from the World Bank Indicators API. The React tab falls back to a browser-only trend model if the backend is unavailable.

The same FastAPI backend also proxies REST Countries v5 country profile requests. This avoids browser CORS issues, keeps the REST Countries bearer token out of frontend code, and **automatically maps the v5 API response back to the v3 response shape** used by the React dashboard (see `to_rest_country_v3_shape()` in `backend/app.py`). The mapping includes:

- Country names (common and official)
- Country codes (ISO 2-letter, 3-letter, CIOC)
- Capital city/cities
- Region and subregion
- Population
- Area (square kilometers)
- Flag URLs (PNG and SVG)
- Bordering countries

This ensures compatibility without breaking the existing frontend while leveraging the latest REST Countries v5 API.

Prediction code is separated from UI code:

- `backend/app.py`
- `src/lib/prediction.ts`
- `src/types/prediction.ts`
- `src/components/Sidebar/PredictionsTab.tsx`

Backend model strategy:

1. Fetch WDI indicators by country and indicator code (with automatic retry and dual-endpoint fallback).
2. Merge indicators by year via concurrent requests (up to 8 parallel workers).
3. Drop features and years with too much missing data (>60% threshold for features, >50% for rows).
4. Fill short gaps with forward-fill/backward-fill (limited to 2 periods to avoid over-imputation).
5. Train models using time-ordered data with engineered features (year and lagged target values).
6. Compare Linear Regression and Random Forest Regressor using recent holdout RMSE.
7. Select the better model and forecast the next five years.
8. Estimate future feature values using simple trend extrapolation.
9. Apply continuity guards and forecast range caps to prevent implausible jumps.
10. Cache predictions at fetch level (indicator data, maxsize=1024) and at model level (predictions, maxsize=256).

Frontend fallback strategy:

1. Damped Holt log-trend model.
2. Log-linear growth model.
3. Centered linear regression fallback.

The backend is the preferred ML forecast. The TypeScript fallback exists only to keep the dashboard usable when the Python service is not running.

Important interpretation note:

- If the backend is reachable and returns success, the dashboard shows backend ML output.
- If backend calls fail (network/server/API errors), the dashboard explicitly shows fallback status.

### WDI Dataset

Dataset name: World Development Indicators (WDI)

Provider: World Bank Open Data

Main API: World Bank Indicators API v2

API Endpoints:
- `http://api.worldbank.org/v2/country/{country}/indicator/{indicator}`
- `https://api.worldbank.org/v2/country/{country}/indicator/{indicator}` (fallback)

Resiliency & Performance:
- Dual URL support for HTTP/HTTPS redundancy
- Automatic retry logic: 4 attempts with exponential backoff (0.75s × attempt)
- Request timeout: 30 seconds
- LRU cache at fetch level (maxsize=1024)
- Concurrent fetching with ThreadPoolExecutor (up to 8 workers for parallel requests)
- Prediction-level caching (maxsize=256) to reduce repeated network load
- Response format: JSON with up to 20,000 records per page

### WDI Indicators Used

Population target:

- `SP.POP.TOTL` - Population, total

Population model input features:

- `SP.POP.GROW` - Population growth annual %
- `SP.DYN.TFRT.IN` - Fertility rate
- `SP.DYN.CBRT.IN` - Birth rate
- `SP.DYN.CDRT.IN` - Death rate
- `SP.DYN.LE00.IN` - Life expectancy at birth
- `SM.POP.NETM` - Net migration
- `SP.URB.TOTL.IN.ZS` - Urban population %
- `EN.POP.DNST` - Population density

GDP per capita target:

- `NY.GDP.PCAP.CD` - GDP per capita

GDP model input features:

- `NY.GDP.MKTP.KD.ZG` - GDP growth annual %
- `FP.CPI.TOTL.ZG` - Inflation annual %
- `SL.UEM.TOTL.ZS` - Unemployment %
- `NE.TRD.GNFS.ZS` - Trade % of GDP
- `BX.KLT.DINV.WD.GD.ZS` - FDI net inflows % of GDP
- `IT.NET.USER.ZS` - Individuals using the Internet %
- `SE.XPD.TOTL.GD.ZS` - Government education expenditure % of GDP
- `SP.URB.TOTL.IN.ZS` - Urban population %
- `SP.DYN.LE00.IN` - Life expectancy at birth

### Prediction Utility Functions

The project includes reusable TypeScript utility functions:

- `cleanTimeSeriesData()`
- `linearRegression()`
- `generateForecast()`
- `calculateMAE()`
- `calculateRMSE()`

### Formula Used: Damped Holt Log-Trend

The primary model is a damped Holt trend model on log-transformed values. This is closer to the trend component used by forecasting systems such as Prophet, but remains lightweight enough to run in the browser.

The observed value is transformed as:

```text
z(t) = ln(y(t))
```

The model updates a smoothed level and trend:

```text
level(t) = alpha * z(t) + (1 - alpha) * (level(t-1) + phi * trend(t-1))
trend(t) = beta * (level(t) - level(t-1)) + (1 - beta) * phi * trend(t-1)
```

The forecast uses a damped future trend:

```text
z(t+h) = level(t) + (phi + phi^2 + ... + phi^h) * trend(t)
y(t+h) = exp(z(t+h))
```

Where:

- `alpha` controls how strongly the latest observation affects the level.
- `beta` controls how quickly the trend changes.
- `phi` damps the trend so forecasts do not explode unrealistically.
- `h` is the forecast horizon in years.

### Formula Used: Linear Regression Fallback

The model fits a straight line:

```text
y = mx + b
```

Where:

- `y` is the predicted indicator value.
- `x` is the year.
- `m` is the slope.
- `b` is the intercept.

The slope is calculated as:

```text
m = (n * sum(xy) - sum(x) * sum(y)) / (n * sum(x^2) - (sum(x))^2)
```

The intercept is calculated as:

```text
b = (sum(y) - m * sum(x)) / n
```

When linear regression is selected, the app forecasts the next five years from the latest available World Bank year:

```text
predictedValue = m * futureYear + b
```

Negative forecasts are clamped to zero because population and GDP per capita cannot be negative in this dashboard context.

### Formula Used: Growth Percentage

The five-year growth percentage is calculated as:

```text
growthPercentage = ((predictedValueInFiveYears - latestActualValue) / latestActualValue) * 100
```

### Formula Used: MAE

Mean Absolute Error measures the average absolute difference between actual values and model-fitted values:

```text
MAE = sum(abs(actualValue - predictedValue)) / n
```

### Formula Used: RMSE

Root Mean Squared Error gives more weight to larger errors:

```text
RMSE = sqrt(sum((actualValue - predictedValue)^2) / n)
```

### Model Evaluation

The Predictions tab displays:

- Selected model name.
- MAE for population.
- RMSE for population.
- R2 score for population.
- Training years used for population.
- MAE for GDP per capita.
- RMSE for GDP per capita.
- R2 score for GDP per capita.
- Training years used for GDP per capita.
- Features used and features dropped.
- Missing data warnings.

### Response Contract (Backend)

Prediction responses include:

- `countryCode`
- `datasetName` = `World Development Indicators (WDI)`
- `provider` = `World Bank Open Data`
- `targetIndicator`
- `modelUsed`
- `featuresUsed`
- `featuresDropped`
- `warnings`
- `historicalData`
- `forecastData`
- `latestActualValue`
- `predictedValueIn5Years`
- `growthPercentage`
- `mae`
- `rmse`
- `r2`
- `trainingYearsUsed`
- `dataCoverageSummary`

### Missing Data Handling

WDI data can be incomplete. The backend cleans and prepares it by:

- Removing null values.
- Dropping indicators with too much missing data.
- Dropping years with too many missing feature values.
- Using limited forward-fill/backward-fill for short gaps.
- Continuing with available optional features where possible.
- Falling back to a trend model when too few ML features or rows are available.
- Returning clear warnings for dropped indicators and weak data coverage.

The UI shows an error or empty state when forecast data is unavailable.

---

## Data Sources

| API                     | Purpose                                                                                              | Free | Authentication                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ---- | -------------------------------- |
| REST Countries v5       | Country profile, capital, region, area, population (API v5 with v3 response shape mapping)              | Yes  | Bearer token, stored server-side |
| World Bank WDI          | Population, GDP, urbanization, health, migration, trade, FDI, education, internet, safety indicators | Yes  | No                               |
| UK Police API           | Street-level crime incidents in Great Britain                                                        | Yes  | No                               |
| OpenStreetMap Overpass  | Road and traffic geospatial data                                                                     | Yes  | No                               |
| OpenAQ                  | Air quality locations and measurements                                                               | Yes  | No                               |
| Natural Earth / GeoJSON | Country boundaries                                                                                   | Yes  | No                               |

---

## Project Structure

```text
urban-analytics/
  backend/
    app.py
    requirements.txt
  src/
    App.tsx
    main.tsx
    styles.css
    components/
      Globe/
      Map/
      Sidebar/
        Analytics.tsx
        PredictionsTab.tsx
      UI/
    hooks/
      usePopulationData.ts
      useCrimeData.ts
      useTrafficData.ts
      useAQIData.ts
      useCountriesGeoJSON.ts
    lib/
      prediction.ts
      clustering.ts
      colorScales.ts
      geoUtils.ts
      overpassQuery.ts
    store/
      useAppStore.ts
    types/
      index.ts
      prediction.ts
  public/
    countries.geojson
  scripts/
    download-geodata.js
    download-geodata.ts
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.ts
  postcss.config.cjs
```

---

## Installation

Prerequisites:

- Node.js 18 or higher.
- npm.
- Python 3.11 or higher.
- Internet connection for API calls.

Install dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

Get a REST Countries v5 API key:

1. Go to `https://restcountries.com/`.
2. Open the REST Countries v5 API documentation or account dashboard.
3. Create an account or sign in.
4. Generate or copy a v5 API key.
5. Keep the key private. It should only be stored in `.env.local`, not in frontend code or tracked files.

Configure local environment variables:

```bash
cp .env.example .env.local
```

Set `REST_COUNTRIES_API_KEY` in `.env.local`:

```env
REST_COUNTRIES_API_KEY=your_rest_countries_v5_key
```

This file is ignored by git. The `npm run dev` script loads `.env.local` automatically before starting FastAPI and Vite.

Run the full development stack:

```bash
npm run dev
```

This starts both services:

```text
Frontend: http://127.0.0.1:5173
Backend:  http://127.0.0.1:8000
```

Run only the backend:

```bash
npm run backend
```

Run only the frontend:

```bash
npm run frontend
```

Open the app:

```text
http://127.0.0.1:5173
```

Build for production:

```bash
npm run build
```

Run TypeScript checks:

```bash
npm run typecheck
```

### Example API Calls

```text
GET http://127.0.0.1:8000/health
        Returns: { status: ok, dataset_name, provider }

GET http://127.0.0.1:8000/country/IND
        Returns: Country profile from REST Countries v5 (mapped to v3 shape)

GET http://127.0.0.1:8000/predict/population/IND
        Returns: Population forecast with ML model details

GET http://127.0.0.1:8000/predict/gdp/IND
        Returns: GDP per capita forecast with ML model details

GET http://127.0.0.1:8000/predict/all/IND
        Returns: Both population and GDP predictions (concurrent, faster load)
```

Each prediction response includes:

- Country code
- Dataset name and provider
- Target indicator and label
- Model used (Linear Regression or Random Forest Regressor)
- Features used (WDI indicator codes) and features dropped with reasons
- Missing data warnings and data coverage summary
- Historical actual data points (year, value pairs)
- Predicted future data (5-year forecast with year, value pairs)
- Latest actual value and predicted value after five years
- Growth percentage
- MAE, RMSE, and R2 score
- Training years used and data coverage breakdown

Note: Responses are cached at multiple levels:
- WDI indicator fetch level (1024 entries)
- Prediction model level (256 country predictions)
- This reduces latency for repeated country queries

---

## Performance & Reliability

### API Resilience
- **Dual endpoint fallback:** HTTP and HTTPS URLs for World Bank API
- **Automatic retry logic:** 4 attempts per request with exponential backoff (0.75s × attempt)
- **Request timeout:** 30 seconds for WDI, 10 seconds for REST Countries
- **REST Countries retry:** 3 automatic retries before failing
- **Concurrent fetching:** Up to 8 parallel workers to fetch multiple WDI indicators simultaneously

### Caching Strategy
- **Fetch-level cache (WDI indicators):** LRU cache with 1024 entries to cache raw indicator data points
- **Prediction-level cache:** LRU cache with 256 entries to cache complete ML prediction results
- **Benefits:** Repeated queries for the same country return cached results instantly, reducing network load and improving dashboard responsiveness

### Response Mapping
- **REST Countries v5 → v3 shape:** Backend automatically maps modern v5 API responses to the v3 schema used by the frontend, ensuring compatibility and simplifying frontend logic

---

## Development Notes

- **WDI API:** Still uses World Bank Indicators API v2 with dual HTTP/HTTPS support and automatic retry logic (4 attempts with exponential backoff).
- **ML prediction logic:** Implemented in `backend/app.py` with scikit-learn models (Linear Regression and Random Forest).
- **REST Countries integration:** Backend proxies v5 API with automatic v3 shape mapping (`to_rest_country_v3_shape()` function).
- **Caching:** Multi-level LRU caching at fetch level (1024 entries) and prediction level (256 entries) for performance.
- **Concurrency:** ThreadPoolExecutor with up to 8 workers for parallel WDI indicator fetching during model training.
- **Frontend fallback prediction:** Kept in `src/lib/prediction.ts` for when backend is unavailable.
- **Prediction UI isolation:** Isolated in `src/components/Sidebar/PredictionsTab.tsx` for maintainability.
- **Existing data sources:** Population, GDP, and country-profile fetching remains in `usePopulationData.ts` and other hooks.
- **REST Countries token:** Required `REST_COUNTRIES_API_KEY`; keep it in `.env.local`, never in tracked source.
- **Model selection:** Linear Regression is an interpretable baseline; Random Forest captures nonlinear relationships among WDI indicators. Best model is selected per country based on holdout RMSE.



## Troubleshooting

### 1) `ERR_CONNECTION_REFUSED` from Predictions tab

Cause: FastAPI backend is not running (or wrong port).

Fix:

- Start backend: `npm run backend` (or `npm run dev` to start both frontend + backend)
- Check health: `http://127.0.0.1:8001/health`
- Verify backend is listening: `netstat -an | findstr :8001` (Windows) or `lsof -i :8001` (Mac/Linux)
- Ensure frontend is calling `127.0.0.1:8001` (not `8000`).
- Check that no other process is occupying port 8001.

### 2) `WinError 10013` or `Errno 10048` on backend start

Cause: port 8001 already in use or restricted by firewall/admin settings.

Fix:

- Keep backend on `8001` as configured in the project.
- Stop previous Python/Uvicorn process: `taskkill /F /IM python.exe` (Windows, may affect other Python apps) or use Task Manager to end the process.
- Check if firewall is blocking: Windows Defender Firewall > Allow an app through firewall > add Python.
- Clear the port: Kill any process on 8001 and wait 30 seconds before retrying.
- Re-run: `npm run backend`

### 3) Backend returns `{"detail":"Not Found"}`

Cause: wrong URL path.

Fix:

- Use valid endpoints:
  - `/health`
  - `/country/{ISO3}`
  - `/predict/population/{ISO3}`
  - `/predict/gdp/{ISO3}`
  - `/predict/all/{ISO3}`

### 4) Backend returns `422 Not enough WDI target data ...`

Cause: insufficient historical target points for that country/indicator.

Fix:

- Try another country with better WDI coverage.
- The frontend will show fallback forecast when backend ML cannot be trained.
- Check `warnings` and `dataCoverageSummary` in backend response.

### 5) `502` / World Bank SSL or upstream API errors

Cause: temporary upstream World Bank API/network issue or SSL certificate problems.

Fix:

- **Automatic retries:** Backend automatically retries failed WDI requests up to 4 times with exponential backoff (0.75s, 1.5s, 2.25s delays).
- **Dual URL fallback:** The backend tries both HTTP and HTTPS endpoints before giving up.
- Manual retry after a few seconds.
- Confirm internet access and DNS resolution: `ping api.worldbank.org`
- Check for upstream issues: Visit [World Bank Open Data status page](https://data.worldbank.org/).
- If the issue persists, the frontend will show a fallback forecast using browser-based trend models (see `src/lib/prediction.ts`).

### 6) REST Countries v5 profile is unavailable

Cause: missing `REST_COUNTRIES_API_KEY`, expired/invalid token, or REST Countries upstream failure.

Fix:

- **Generate/refresh token:** Log into [REST Countries v5 dashboard](https://restcountries.com/) and generate a new v5 API key.
- **Update `.env.local`:** Confirm it contains `REST_COUNTRIES_API_KEY=your_actual_key` (no quotes).
- **Restart both services:** `npm run dev` (or restart both frontend and backend separately) after changing `.env.local`.
- **Test endpoint:** `http://127.0.0.1:8001/country/CAN` should return country profile in v3 response shape (internally mapped from v5).
- **Retry logic:** Backend automatically retries REST Countries requests 3 times before giving up.
- **Isolation:** Country profile failure is isolated from World Bank WDI and prediction data; population, GDP, and predictions can still load without the profile.

### 7) World Bank says an indicator was deleted or archived

Cause: World Bank can remove or archive individual indicator codes.

Fix:

- Replace the indicator with a currently available World Bank indicator.
- This does not affect the prediction endpoints unless one of the prediction WDI feature codes is removed.

---

## Limitations

- Random Forest cannot extrapolate structural future shocks by itself; future features are estimated from recent historical trends.
- The model cannot fully capture sudden economic shocks, policy changes, wars, pandemics, or nonlinear demographic transitions without richer explanatory variables.
- Forecast quality depends on the completeness and reliability of World Bank historical data.
- Some countries may have sparse GDP, migration, education, trade, FDI, unemployment, or internet data.
- Public APIs may fail, rate limit, or return incomplete responses.
- Large visualization libraries increase production bundle size.

---
