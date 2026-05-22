export interface TimeSeriesPoint {
  year: number
  value: number
}

export interface RegressionModel {
  name: string
  slope: number
  intercept: number
  predict: (year: number) => number
}

export interface ForecastPoint extends TimeSeriesPoint {
  kind: 'forecast'
}

export interface PredictionMetrics {
  mae: number | null
  rmse: number | null
  trainingYears: number
  holdoutYears: number
}

export interface PredictionResult {
  historical: TimeSeriesPoint[]
  forecast: ForecastPoint[]
  model: RegressionModel | null
  metrics: PredictionMetrics
}

export interface WdiPredictionPoint {
  year: number
  value: number
}

export interface WdiCoverageSummary {
  first_year: number
  latest_year: number
  target_years_available: number
  usable_training_rows: number
  features_requested: number
  features_used: number
  features_dropped: number
}

export interface WdiPredictionResponse {
  country_code: string
  dataset_name: string
  provider: string
  target_indicator: string
  target_label: string
  model_used: string
  features_used: string[]
  features_dropped: string[]
  missing_data_warnings: string[]
  historical_actual_data: WdiPredictionPoint[]
  predicted_future_data: WdiPredictionPoint[]
  latest_actual_value: number
  predicted_value_after_5_years: number
  growth_percentage: number | null
  mae: number | null
  rmse: number | null
  r2_score: number | null
  training_years_used: number
  data_coverage_summary: WdiCoverageSummary
}

export interface WdiAllPredictionResponse {
  country_code: string
  dataset_name: string
  provider: string
  population: WdiPredictionResponse
  gdp: WdiPredictionResponse
}
