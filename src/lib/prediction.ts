import { WorldBankSeries } from '@/types'
import {
  ForecastPoint,
  PredictionResult,
  RegressionModel,
  TimeSeriesPoint
} from '@/types/prediction'

export function cleanTimeSeriesData(
  series: WorldBankSeries | null | undefined
): TimeSeriesPoint[] {
  return (series ?? [])
    .map((point) => ({
      year: Number(point.date),
      value: point.value === null ? Number.NaN : Number(point.value)
    }))
    .filter((point) => Number.isFinite(point.year) && Number.isFinite(point.value))
    .sort((a, b) => a.year - b.year)
}

export function linearRegression(points: TimeSeriesPoint[]): RegressionModel | null {
  if (points.length < 2) return null

  const n = points.length
  const sumX = points.reduce((sum, point) => sum + point.year, 0)
  const sumY = points.reduce((sum, point) => sum + point.value, 0)
  const sumXY = points.reduce((sum, point) => sum + point.year * point.value, 0)
  const sumXX = points.reduce((sum, point) => sum + point.year * point.year, 0)
  const denominator = n * sumXX - sumX * sumX

  if (denominator === 0) return null

  // Ordinary least squares fits y = mx + b by minimizing squared residuals.
  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return {
    slope,
    intercept,
    predict: (year: number) => slope * year + intercept
  }
}

export function generateForecast(
  model: RegressionModel | null,
  latestYear: number,
  years = 5
): ForecastPoint[] {
  if (!model || !Number.isFinite(latestYear) || years <= 0) return []

  return Array.from({ length: years }, (_, index) => {
    const year = latestYear + index + 1
    return {
      year,
      value: Math.max(model.predict(year), 0),
      kind: 'forecast' as const
    }
  })
}

export function calculateMAE(
  actual: TimeSeriesPoint[],
  predicted: TimeSeriesPoint[]
): number | null {
  const pairs = actual
    .map((point, index) => ({ actual: point.value, predicted: predicted[index]?.value }))
    .filter((point) => Number.isFinite(point.actual) && Number.isFinite(point.predicted))

  if (pairs.length === 0) return null

  const absoluteError = pairs.reduce(
    (sum, point) => sum + Math.abs(point.actual - point.predicted),
    0
  )

  return absoluteError / pairs.length
}

export function calculateRMSE(
  actual: TimeSeriesPoint[],
  predicted: TimeSeriesPoint[]
): number | null {
  const pairs = actual
    .map((point, index) => ({ actual: point.value, predicted: predicted[index]?.value }))
    .filter((point) => Number.isFinite(point.actual) && Number.isFinite(point.predicted))

  if (pairs.length === 0) return null

  const squaredError = pairs.reduce(
    (sum, point) => sum + Math.pow(point.actual - point.predicted, 2),
    0
  )

  return Math.sqrt(squaredError / pairs.length)
}

export function buildPrediction(
  series: WorldBankSeries | null | undefined,
  forecastYears = 5
): PredictionResult {
  const historical = cleanTimeSeriesData(series)
  const model = linearRegression(historical)
  const latestYear = historical[historical.length - 1]?.year
  const forecast = latestYear ? generateForecast(model, latestYear, forecastYears) : []
  const fitted = model
    ? historical.map((point) => ({ year: point.year, value: model.predict(point.year) }))
    : []

  return {
    historical,
    forecast,
    model,
    metrics: {
      mae: calculateMAE(historical, fitted),
      rmse: calculateRMSE(historical, fitted),
      trainingYears: historical.length
    }
  }
}
