export interface TimeSeriesPoint {
  year: number
  value: number
}

export interface RegressionModel {
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
}

export interface PredictionResult {
  historical: TimeSeriesPoint[]
  forecast: ForecastPoint[]
  model: RegressionModel | null
  metrics: PredictionMetrics
}
