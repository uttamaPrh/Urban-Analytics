# Urban Analytics Platform

A geospatial urban analytics platform for exploring country-level demographics, economic indicators, safety signals, and five-year forecasts through an interactive 3D globe and dashboard interface.

Tech stack: Vite, React 18, TypeScript, TailwindCSS, Zustand, TanStack React Query, Recharts, Globe.gl, MapLibre GL, and Deck.gl.

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
- Model evaluation with MAE, RMSE, and number of training years.
- Public API based data fetching with no paid APIs or backend service.

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

It uses existing World Bank historical time-series data already fetched by `usePopulationData`.

Prediction code is separated from UI code:

- `src/lib/prediction.ts`
- `src/types/prediction.ts`
- `src/components/Sidebar/PredictionsTab.tsx`

The forecast method now uses a small explainable model-selection pipeline that runs fully in TypeScript:

1. Damped Holt log-trend model.
2. Log-linear growth model.
3. Centered linear regression fallback.

The app tests candidate models on recent holdout years using RMSE, selects the best model, then retrains that model on all available historical data before generating the five-year forecast.

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
- Training years used for population.
- MAE for GDP per capita.
- RMSE for GDP per capita.
- Training years used for GDP per capita.

### Missing Data Handling

World Bank data can be incomplete. The prediction utilities clean the source data by:

- Removing null values.
- Removing non-numeric years.
- Removing non-numeric values.
- Sorting values by year.
- Returning no forecast if fewer than two usable data points exist.

The UI shows an error or empty state when forecast data is unavailable.

---

## Data Sources

| API | Purpose | Free | Authentication |
| --- | --- | --- | --- |
| REST Countries | Country profile, capital, region, area, population | Yes | No |
| World Bank | Population, urbanization, GDP per capita, safety indicators | Yes | No |
| UK Police API | Street-level crime incidents in Great Britain | Yes | No |
| OpenStreetMap Overpass | Road and traffic geospatial data | Yes | No |
| OpenAQ | Air quality locations and measurements | Yes | No |
| Natural Earth / GeoJSON | Country boundaries | Yes | No |

---

## Project Structure

```text
urban-analytics/
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

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Build for production:

```bash
npm run build
```

Run TypeScript checks:

```bash
npm run typecheck
```

---

## Development Notes

- Prediction logic is intentionally kept in `src/lib/prediction.ts`.
- Prediction UI is isolated in `src/components/Sidebar/PredictionsTab.tsx`.
- Existing population and GDP data fetching remains in `usePopulationData.ts`.
- No paid APIs, private keys, or backend services are required.
- The damped Holt log-trend model is explainable and suitable for academic reporting because its level, trend, damping, MAE, and RMSE can be described directly.

---

## Limitations

- The browser model is still simpler than backend-trained Random Forest, XGBoost, Prophet, LSTM, or Transformer models.
- The model cannot fully capture sudden economic shocks, policy changes, wars, pandemics, or nonlinear demographic transitions without extra explanatory variables.
- Forecast quality depends on the completeness and reliability of World Bank historical data.
- Some countries may have sparse GDP or safety data.
- Public APIs may fail, rate limit, or return incomplete responses.
- Large visualization libraries increase production bundle size.

---

## License

MIT
