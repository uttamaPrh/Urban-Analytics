import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { WorldBankSeries } from '@/types'
import { buildPrediction } from '@/lib/prediction'
import {
  PredictionResult,
  WdiAllPredictionResponse,
  WdiPredictionResponse
} from '@/types/prediction'

interface PredictionsTabProps {
  countryCode?: string
  populationSeries: WorldBankSeries | null | undefined
  gdpPerCapitaSeries: WorldBankSeries | null | undefined
}

interface PredictionChartPoint {
  year: number
  actual?: number
  forecast?: number
}

const PREDICTION_API_URL =
  import.meta.env.VITE_PREDICTION_API_URL ?? 'http://127.0.0.1:8000'

async function fetchWdiPredictions(countryCode: string): Promise<WdiAllPredictionResponse> {
  const response = await fetch(`${PREDICTION_API_URL}/predict/all/${countryCode}`)
  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(`Prediction backend returned ${response.status}. ${message}`)
  }
  return (await response.json()) as WdiAllPredictionResponse
}

function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return Intl.NumberFormat('en', {
    maximumFractionDigits: digits
  }).format(value)
}

function calculateGrowth(latest: number | null, predicted: number | null): number | null {
  if (!latest || predicted === null) return null
  return ((predicted - latest) / latest) * 100
}

function toBackendChartData(
  result: WdiPredictionResponse,
  scale = 1,
  historicalYears = 12
): PredictionChartPoint[] {
  const visibleHistorical = result.historical_actual_data.slice(-historicalYears)
  const latestActual = result.historical_actual_data[result.historical_actual_data.length - 1]
  const rows = new Map<number, PredictionChartPoint>()

  visibleHistorical.forEach((point) => {
    rows.set(point.year, {
      year: point.year,
      actual: point.value / scale
    })
  })

  if (latestActual) {
    rows.set(latestActual.year, {
      ...rows.get(latestActual.year),
      year: latestActual.year,
      forecast: latestActual.value / scale
    })
  }

  result.predicted_future_data.forEach((point) => {
    rows.set(point.year, {
      year: point.year,
      forecast: point.value / scale
    })
  })

  return Array.from(rows.values()).sort((a, b) => a.year - b.year)
}

function toFallbackChartData(
  result: PredictionResult,
  scale = 1,
  historicalYears = 12
): PredictionChartPoint[] {
  const visibleHistorical = result.historical.slice(-historicalYears)
  const latestActual = result.historical[result.historical.length - 1]
  const rows = new Map<number, PredictionChartPoint>()

  visibleHistorical.forEach((point) => {
    rows.set(point.year, {
      year: point.year,
      actual: point.value / scale
    })
  })

  if (latestActual && result.forecast.length > 0) {
    rows.set(latestActual.year, {
      ...rows.get(latestActual.year),
      year: latestActual.year,
      forecast: latestActual.value / scale
    })
  }

  result.forecast.forEach((point) => {
    rows.set(point.year, {
      year: point.year,
      forecast: point.value / scale
    })
  })

  return Array.from(rows.values()).sort((a, b) => a.year - b.year)
}

function KpiCard({
  label,
  value,
  detail,
  tone
}: {
  label: string
  value: string
  detail: string
  tone: 'cyan' | 'green' | 'amber' | 'rose'
}) {
  const tones = {
    cyan: 'from-cyan-500/20 to-sky-500/5 border-cyan-300/20',
    green: 'from-emerald-500/20 to-teal-500/5 border-emerald-300/20',
    amber: 'from-amber-500/20 to-orange-500/5 border-amber-300/20',
    rose: 'from-rose-500/20 to-red-500/5 border-rose-300/20'
  }

  return (
    <div className={`rounded-lg border bg-gradient-to-br p-5 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
        {label}
      </div>
      <div className="mt-3 text-2xl font-bold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{detail}</div>
    </div>
  )
}

function ChartPanel({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          {title}
        </div>
        <div className="flex gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-full bg-cyan-300" />
            Actual
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-full bg-amber-300" />
            Forecast
          </span>
        </div>
      </div>
      <div className="h-80">{children}</div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/70 p-6 text-slate-300">
      {label}
    </div>
  )
}

function PredictionChart({
  data,
  latestYear,
  yAxisWidth,
  valueFormatter
}: {
  data: PredictionChartPoint[]
  latestYear: number | undefined
  yAxisWidth: number
  valueFormatter: (value: number | null | undefined) => string
}) {
  if (data.length < 2 || latestYear === undefined) {
    return <EmptyState label="Not enough historical data to generate a forecast chart." />
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
        <YAxis
          stroke="#94a3b8"
          tickLine={false}
          width={yAxisWidth}
          tickFormatter={(value) => valueFormatter(Number(value))}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
          formatter={(value, name) => [
            valueFormatter(Number(value)),
            name === 'actual' ? 'Actual' : 'Forecast'
          ]}
        />
        <ReferenceLine x={latestYear} stroke="#f59e0b" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke="#22d3ee"
          strokeWidth={3}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Forecast"
          stroke="#f59e0b"
          strokeWidth={3}
          strokeDasharray="7 5"
          dot={{ r: 3 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function BackendMetricsPanel({
  title,
  result,
  valueFormatter
}: {
  title: string
  result: WdiPredictionResponse
  valueFormatter: (value: number | null | undefined) => string
}) {
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-5">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        {title}
      </div>
      <dl className="mt-5 grid gap-4 text-sm md:grid-cols-4">
        <div className="rounded-md bg-slate-950/70 p-4">
          <dt className="text-slate-400">Model</dt>
          <dd className="mt-2 text-lg font-bold text-white">{result.model_used}</dd>
        </div>
        <div className="rounded-md bg-slate-950/70 p-4">
          <dt className="text-slate-400">MAE</dt>
          <dd className="mt-2 text-xl font-bold text-white">{valueFormatter(result.mae)}</dd>
        </div>
        <div className="rounded-md bg-slate-950/70 p-4">
          <dt className="text-slate-400">RMSE</dt>
          <dd className="mt-2 text-xl font-bold text-white">{valueFormatter(result.rmse)}</dd>
        </div>
        <div className="rounded-md bg-slate-950/70 p-4">
          <dt className="text-slate-400">R2 / years</dt>
          <dd className="mt-2 text-xl font-bold text-white">
            {formatNumber(result.r2_score, 2)} / {result.training_years_used}
          </dd>
        </div>
      </dl>
      <div className="mt-5 grid gap-4 text-sm lg:grid-cols-2">
        <div>
          <div className="mb-2 font-semibold text-slate-300">Features used</div>
          <div className="flex flex-wrap gap-2">
            {result.features_used.length > 0 ? (
              result.features_used.map((feature) => (
                <span key={feature} className="rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-cyan-100">
                  {feature}
                </span>
              ))
            ) : (
              <span className="text-slate-400">Trend fallback only</span>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 font-semibold text-slate-300">Dropped features</div>
          <div className="flex flex-wrap gap-2">
            {result.features_dropped.length > 0 ? (
              result.features_dropped.map((feature) => (
                <span key={feature} className="rounded-md border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-amber-100">
                  {feature}
                </span>
              ))
            ) : (
              <span className="text-slate-400">None</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FallbackMetricsPanel({
  title,
  result,
  valueFormatter
}: {
  title: string
  result: PredictionResult
  valueFormatter: (value: number | null | undefined) => string
}) {
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-5">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        {title}
      </div>
      <dl className="mt-5 grid gap-4 text-sm md:grid-cols-4">
        <div className="rounded-md bg-slate-950/70 p-4">
          <dt className="text-slate-400">Model</dt>
          <dd className="mt-2 text-lg font-bold text-white">
            {result.model?.name ?? 'Unavailable'}
          </dd>
        </div>
        <div className="rounded-md bg-slate-950/70 p-4">
          <dt className="text-slate-400">MAE</dt>
          <dd className="mt-2 text-xl font-bold text-white">
            {valueFormatter(result.metrics.mae)}
          </dd>
        </div>
        <div className="rounded-md bg-slate-950/70 p-4">
          <dt className="text-slate-400">RMSE</dt>
          <dd className="mt-2 text-xl font-bold text-white">
            {valueFormatter(result.metrics.rmse)}
          </dd>
        </div>
        <div className="rounded-md bg-slate-950/70 p-4">
          <dt className="text-slate-400">Training years</dt>
          <dd className="mt-2 text-xl font-bold text-white">
            {result.metrics.trainingYears}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function WarningsPanel({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300/30 bg-amber-950/20 p-5 text-sm text-amber-100">
      <div className="mb-3 font-semibold uppercase tracking-wide">Missing Data Warnings</div>
      <ul className="space-y-2">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  )
}

export default function PredictionsTab({
  countryCode,
  populationSeries,
  gdpPerCapitaSeries
}: PredictionsTabProps): JSX.Element {
  const backendPrediction = useQuery<WdiAllPredictionResponse, Error>({
    queryKey: ['wdi-predictions', countryCode],
    queryFn: () => fetchWdiPredictions(countryCode as string),
    enabled: !!countryCode,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 3,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  })

  const populationFallback = useMemo(
    () => buildPrediction(populationSeries, 5),
    [populationSeries]
  )
  const gdpFallback = useMemo(
    () => buildPrediction(gdpPerCapitaSeries, 5),
    [gdpPerCapitaSeries]
  )

  if (backendPrediction.isLoading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-6 text-slate-300">
        <div className="font-semibold text-white">Loading WDI machine learning forecasts...</div>
        <div className="mt-2 text-sm text-slate-400">
          The first request can take 20-45 seconds because the backend fetches multiple World Bank indicators and trains ML models.
        </div>
      </div>
    )
  }

  if (backendPrediction.data) {
    const population = backendPrediction.data.population
    const gdp = backendPrediction.data.gdp
    const latestPopulation = population.historical_actual_data[population.historical_actual_data.length - 1]
    const latestGdp = gdp.historical_actual_data[gdp.historical_actual_data.length - 1]
    const finalPopulationForecast = population.predicted_future_data[population.predicted_future_data.length - 1]
    const finalGdpForecast = gdp.predicted_future_data[gdp.predicted_future_data.length - 1]
    const populationChartData = toBackendChartData(population, 1000000)
    const gdpChartData = toBackendChartData(gdp)
    const warnings = [
      ...population.missing_data_warnings.map((warning) => `Population: ${warning}`),
      ...gdp.missing_data_warnings.map((warning) => `GDP: ${warning}`)
    ]

    return (
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-5">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Dataset
          </div>
          <div className="mt-2 text-lg font-bold text-white">{backendPrediction.data.dataset_name}</div>
          <div className="text-sm text-slate-400">{backendPrediction.data.provider}</div>
          <div className="mt-3 inline-flex rounded-md border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-100">
            Using FastAPI WDI ML backend, not frontend fallback
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            label="Latest population"
            value={formatCompact(population.latest_actual_value)}
            detail={latestPopulation ? `Actual ${latestPopulation.year}` : 'Unavailable'}
            tone="cyan"
          />
          <KpiCard
            label="Population in 5 years"
            value={formatCompact(population.predicted_value_after_5_years)}
            detail={`Forecast ${finalPopulationForecast?.year ?? ''}`}
            tone="green"
          />
          <KpiCard
            label="Population growth"
            value={`${formatNumber(population.growth_percentage)}%`}
            detail="Five-year forecast"
            tone="cyan"
          />
          <KpiCard
            label="Latest GDP per capita"
            value={formatCurrency(gdp.latest_actual_value)}
            detail={latestGdp ? `Actual ${latestGdp.year}` : 'Unavailable'}
            tone="amber"
          />
          <KpiCard
            label="GDP per capita in 5 years"
            value={formatCurrency(gdp.predicted_value_after_5_years)}
            detail={`Forecast ${finalGdpForecast?.year ?? ''}`}
            tone="rose"
          />
          <KpiCard
            label="GDP growth"
            value={`${formatNumber(gdp.growth_percentage)}%`}
            detail="Five-year forecast"
            tone="amber"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ChartPanel title="Population ML Forecast (millions)">
            <PredictionChart
              data={populationChartData}
              latestYear={latestPopulation?.year}
              yAxisWidth={56}
              valueFormatter={(value) => `${formatNumber(value, 0)}M`}
            />
          </ChartPanel>
          <ChartPanel title="GDP Per Capita ML Forecast">
            <PredictionChart
              data={gdpChartData}
              latestYear={latestGdp?.year}
              yAxisWidth={72}
              valueFormatter={formatCurrency}
            />
          </ChartPanel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <BackendMetricsPanel
            title="Population Model Evaluation"
            result={population}
            valueFormatter={formatCompact}
          />
          <BackendMetricsPanel
            title="GDP Model Evaluation"
            result={gdp}
            valueFormatter={formatCurrency}
          />
        </section>

        <WarningsPanel warnings={warnings} />
      </div>
    )
  }

  const latestPopulation = populationFallback.historical[populationFallback.historical.length - 1]
  const latestGdp = gdpFallback.historical[gdpFallback.historical.length - 1]
  const predictedPopulation = populationFallback.forecast[populationFallback.forecast.length - 1]
  const predictedGdp = gdpFallback.forecast[gdpFallback.forecast.length - 1]
  const populationGrowth = calculateGrowth(latestPopulation?.value ?? null, predictedPopulation?.value ?? null)
  const gdpGrowth = calculateGrowth(latestGdp?.value ?? null, predictedGdp?.value ?? null)
  const populationChartData = toFallbackChartData(populationFallback, 1000000)
  const gdpChartData = toFallbackChartData(gdpFallback)

  if (populationFallback.forecast.length === 0 && gdpFallback.forecast.length === 0) {
    return (
      <EmptyState label="Prediction data is unavailable for this country because the World Bank time series is missing or too short." />
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-300/30 bg-amber-950/20 p-4 text-sm text-amber-100">
        WDI ML backend is unavailable, so the dashboard is showing the browser fallback forecast.
        {backendPrediction.error ? ` Reason: ${backendPrediction.error.message}.` : ''}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Latest population"
          value={formatCompact(latestPopulation?.value)}
          detail={latestPopulation ? `Actual ${latestPopulation.year}` : 'Unavailable'}
          tone="cyan"
        />
        <KpiCard
          label="Population in 5 years"
          value={formatCompact(predictedPopulation?.value)}
          detail={predictedPopulation ? `Forecast ${predictedPopulation.year}` : 'Unavailable'}
          tone="green"
        />
        <KpiCard
          label="Latest GDP per capita"
          value={formatCurrency(latestGdp?.value)}
          detail={latestGdp ? `Actual ${latestGdp.year}` : 'Unavailable'}
          tone="amber"
        />
        <KpiCard
          label="GDP per capita in 5 years"
          value={formatCurrency(predictedGdp?.value)}
          detail={predictedGdp ? `Forecast ${predictedGdp.year}` : 'Unavailable'}
          tone="rose"
        />
        <KpiCard
          label="5-year growth"
          value={`${formatNumber(populationGrowth)}%`}
          detail={`GDP per capita: ${formatNumber(gdpGrowth)}%`}
          tone="cyan"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Population Fallback Forecast (millions)">
          <PredictionChart
            data={populationChartData}
            latestYear={latestPopulation?.year}
            yAxisWidth={56}
            valueFormatter={(value) => `${formatNumber(value, 0)}M`}
          />
        </ChartPanel>
        <ChartPanel title="GDP Per Capita Fallback Forecast">
          <PredictionChart
            data={gdpChartData}
            latestYear={latestGdp?.year}
            yAxisWidth={72}
            valueFormatter={formatCurrency}
          />
        </ChartPanel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <FallbackMetricsPanel
          title="Population Fallback Evaluation"
          result={populationFallback}
          valueFormatter={formatCompact}
        />
        <FallbackMetricsPanel
          title="GDP Fallback Evaluation"
          result={gdpFallback}
          valueFormatter={formatCurrency}
        />
      </section>
    </div>
  )
}
