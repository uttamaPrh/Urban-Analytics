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
- Public API based data fetching with no paid APIs.

---

## Dashboard Tabs

- Overview: headline KPIs and core trend charts.
- Population: population trend, country profile, area, density, region, and subregion.
- Economy: GDP per capita and urbanization trends.
- Crime & Safety: global homicide rate, business crime impact, and local UK incident data where available.
- Predictions: five-year forecasts for population and GDP per capita.

---

## Predictions Feature

The Predictions tab forecasts:

1. Population growth.
2. GDP per capita growth.

The main prediction path uses a Python FastAPI backend that fetches World Bank World Development Indicators directly from the World Bank Indicators API. The React tab falls back to a browser-only trend model if the backend is unavailable.

Prediction code is separated from UI code:

- `backend/app.py`
- `src/lib/prediction.ts`
- `src/types/prediction.ts`
- `src/components/Sidebar/PredictionsTab.tsx`

Backend model strategy:

1. Fetch WDI indicators by country and indicator code.
2. Merge indicators by year.
3. Drop features and years with too much missing data.
4. Fill short gaps with forward-fill/backward-fill.
5. Train models using time-ordered data.
6. Compare Linear Regression and Random Forest Regressor using recent holdout RMSE.
7. Select the better model and forecast the next five years.
8. Estimate future feature values using simple trend extrapolation.

Frontend fallback strategy:

1. Damped Holt log-trend model.
2. Log-linear growth model.
3. Centered linear regression fallback.

The backend is the preferred ML forecast. The TypeScript fallback exists only to keep the dashboard usable when the Python service is not running.

### WDI Dataset

Dataset name: World Development Indicators (WDI)

Provider: World Bank Open Data

Main API: World Bank Indicators API

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

| API | Purpose | Free | Authentication |
| --- | --- | --- | --- |
| REST Countries | Country profile, capital, region, area, population | Yes | No |
| World Bank WDI | Population, GDP, urbanization, health, migration, trade, FDI, education, internet, safety indicators | Yes | No |
| UK Police API | Street-level crime incidents in Great Britain | Yes | No |
| OpenStreetMap Overpass | Road and traffic geospatial data | Yes | No |
| OpenAQ | Air quality locations and measurements | Yes | No |
| Natural Earth / GeoJSON | Country boundaries | Yes | No |

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
- Internet connection for API calls.

Install dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

Run the backend:

```bash
npm run backend
```

Backend URL:

```text
http://127.0.0.1:8001
```

Run the frontend development server:

```bash
npm run dev
```

Open:

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
GET http://127.0.0.1:8001/health
GET http://127.0.0.1:8001/predict/population/IND
GET http://127.0.0.1:8001/predict/gdp/IND
GET http://127.0.0.1:8001/predict/all/IND
```

Each prediction response includes:

- Country code
- Dataset name and provider
- Target indicator
- Model used
- Features used and dropped
- Missing data warnings
- Historical actual data
- Predicted future data
- Latest actual value
- Predicted value after five years
- Growth percentage
- MAE, RMSE, and R2
- Training years used
- Data coverage summary

---

## Development Notes

- ML prediction logic is implemented in `backend/app.py`.
- Frontend fallback prediction logic is kept in `src/lib/prediction.ts`.
- Prediction UI is isolated in `src/components/Sidebar/PredictionsTab.tsx`.
- Existing population and GDP data fetching remains in `usePopulationData.ts`.
- No paid APIs or private keys are required.
- The backend compares Linear Regression and Random Forest Regressor because Linear Regression is an interpretable baseline and Random Forest can capture nonlinear relationships among WDI indicators.

---

## Limitations

- Random Forest cannot extrapolate structural future shocks by itself; future features are estimated from recent historical trends.
- The model cannot fully capture sudden economic shocks, policy changes, wars, pandemics, or nonlinear demographic transitions without richer explanatory variables.
- Forecast quality depends on the completeness and reliability of World Bank historical data.
- Some countries may have sparse GDP, migration, education, trade, FDI, unemployment, or internet data.
- Public APIs may fail, rate limit, or return incomplete responses.
- Large visualization libraries increase production bundle size.

---

## License

MIT
