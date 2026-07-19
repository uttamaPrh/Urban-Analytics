import { WorldBankSeries } from '@/types'
import {
  ForecastPoint,
  PredictionResult,
  RegressionModel,
  TimeSeriesPoint
} from '@/types/prediction'

type ModelFactory = (points: TimeSeriesPoint[]) => RegressionModel | null

export function cleanTimeSeriesData(
  series: WorldBankSeries | null | undefined
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = []

  for (const point of series ?? []) {
    const year = Number(point.date)
    const value = point.value === null ? Number.NaN : Number(point.value)

    if (Number.isFinite(year) && Number.isFinite(value) && value > 0) {
      points.push({ year, value })
    }
  }

  points.sort((a, b) => a.year - b.year)
  return points
}

export function linearRegression(points: TimeSeriesPoint[]): RegressionModel | null {
  if (points.length < 2) return null

  const originYear = points[0].year
  const n = points.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (const point of points) {
    const x = point.year - originYear
    const y = point.value
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const denominator = n * sumXX - sumX * sumX

  if (denominator === 0) return null

  // Ordinary least squares fits y = mx + b. Years are shifted to avoid
  // numerical instability from multiplying large calendar-year values.
  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return {
    name: 'Linear regression',
    slope,
    intercept,
    predict: (year: number) => Math.max(slope * (year - originYear) + intercept, 0)
  }
}

function logLinearRegression(points: TimeSeriesPoint[]): RegressionModel | null {
  const logged: TimeSeriesPoint[] = new Array(points.length)

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    logged[index] = {
      year: point.year,
      value: Math.log(point.value)
    }
  }

  const model = linearRegression(logged)

  if (!model) return null

  return {
    name: 'Log-linear growth',
    slope: model.slope,
    intercept: model.intercept,
    predict: (year: number) => Math.exp(model.predict(year))
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function recentAnnualGrowth(points: TimeSeriesPoint[], years = 8): number {
  const growthRates: number[] = []
  const startIndex = Math.max(points.length - years, 0)

  for (let index = startIndex + 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (previous.value > 0 && current.value > 0) {
      growthRates.push(Math.log(current.value / previous.value))
    }
  }

  return median(growthRates)
}

function dampedHoltLogModel(points: TimeSeriesPoint[]): RegressionModel | null {
  if (points.length < 4) return logLinearRegression(points)

  const values: number[] = new Array(points.length)
  for (let index = 0; index < points.length; index += 1) {
    values[index] = Math.log(points[index].value)
  }

  const latestYear = points[points.length - 1].year
  const latestActual = points[points.length - 1].value
  const initialTrend = values[1] - values[0]

  let best:
    | {
        alpha: number
        beta: number
        phi: number
        error: number
        level: number
        trend: number
      }
    | null = null

  for (const alpha of [0.35, 0.5, 0.65, 0.8]) {
    for (const beta of [0.05, 0.1, 0.2, 0.35]) {
      for (const phi of [0.8, 0.9, 0.95, 0.98]) {
        let level = values[0]
        let trend = initialTrend
        let error = 0

        for (let index = 1; index < values.length; index += 1) {
          const forecast = level + phi * trend
          const actual = values[index]
          const previousLevel = level

          error += Math.pow(actual - forecast, 2)
          level = alpha * actual + (1 - alpha) * forecast
          trend = beta * (level - previousLevel) + (1 - beta) * phi * trend
        }

        if (!best || error < best.error) {
          best = { alpha, beta, phi, error, level, trend }
        }
      }
    }
  }

  if (!best) return null

  const recentGrowth = recentAnnualGrowth(points)
  const blendedTrend = 0.65 * best.trend + 0.35 * recentGrowth

  return {
    name: 'Damped Holt log-trend',
    slope: blendedTrend,
    intercept: Math.log(latestActual),
    predict: (year: number) => {
      const horizon = Math.max(year - latestYear, 0)
      if (horizon === 0) return latestActual

      // Damped Holt forecasts a nonlinear trend that gradually flattens:
      // y(t+h) = level + (phi + phi^2 + ... + phi^h) * trend.
      const dampedTrend =
        best.phi * (1 - Math.pow(best.phi, horizon)) / (1 - best.phi)
      return Math.exp(Math.log(latestActual) + dampedTrend * blendedTrend)
    }
  }
}

function evaluateModel(
  model: RegressionModel,
  actual: TimeSeriesPoint[]
): { mae: number | null; rmse: number | null } {
  const predicted = actual.map((point) => ({
    year: point.year,
    value: model.predict(point.year)
  }))

  return {
    mae: calculateMAE(actual, predicted),
    rmse: calculateRMSE(actual, predicted)
  }
}

function selectBestModel(points: TimeSeriesPoint[]): {
  model: RegressionModel | null
  holdoutYears: number
} {
  if (points.length < 2) return { model: null, holdoutYears: 0 }

  const holdoutYears = Math.min(5, Math.max(1, Math.floor(points.length * 0.15)))
  const training = points.length > 8 ? points.slice(0, -holdoutYears) : points
  const holdout = points.length > 8 ? points.slice(-holdoutYears) : points
  const factories: ModelFactory[] = [
    dampedHoltLogModel,
    logLinearRegression,
    linearRegression
  ]

  let bestCandidate:
    | {
        factory: ModelFactory
        model: RegressionModel
        rmse: number
      }
    | null = null

  for (const factory of factories) {
    const model = factory(training)
    if (!model) continue

    const rmse = evaluateModel(model, holdout).rmse ?? Number.POSITIVE_INFINITY
    if (!bestCandidate || rmse < bestCandidate.rmse) {
      bestCandidate = { factory, model, rmse }
    }
  }

  if (!bestCandidate) return { model: null, holdoutYears: 0 }

  const fullModel = bestCandidate.factory(points) ?? bestCandidate.model

  return {
    model: fullModel,
    holdoutYears: points.length > 8 ? holdoutYears : 0
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
  let absoluteError = 0
  let count = 0

  for (let index = 0; index < actual.length; index += 1) {
    const actualValue = actual[index].value
    const predictedValue = predicted[index]?.value

    if (!Number.isFinite(actualValue) || !Number.isFinite(predictedValue)) continue

    absoluteError += Math.abs(actualValue - predictedValue)
    count += 1
  }

  return count === 0 ? null : absoluteError / count
}

export function calculateRMSE(
  actual: TimeSeriesPoint[],
  predicted: TimeSeriesPoint[]
): number | null {
  let squaredError = 0
  let count = 0

  for (let index = 0; index < actual.length; index += 1) {
    const actualValue = actual[index].value
    const predictedValue = predicted[index]?.value

    if (!Number.isFinite(actualValue) || !Number.isFinite(predictedValue)) continue

    const error = actualValue - predictedValue
    squaredError += error * error
    count += 1
  }

  return count === 0 ? null : Math.sqrt(squaredError / count)
}

export function buildPrediction(
  series: WorldBankSeries | null | undefined,
  forecastYears = 5
): PredictionResult {
  const historical = cleanTimeSeriesData(series)
  const { model, holdoutYears } = selectBestModel(historical)
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
      ...evaluateModel(model ?? { name: '', slope: 0, intercept: 0, predict: () => Number.NaN }, historical),
      trainingYears: Math.max(historical.length - holdoutYears, 0),
      holdoutYears
    }
  }
}
