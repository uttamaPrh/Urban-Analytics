import React, { useMemo } from 'react'
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
import { PredictionResult } from '@/types/prediction'

interface PredictionsTabProps {
  populationSeries: WorldBankSeries | null | undefined
  gdpPerCapitaSeries: WorldBankSeries | null | undefined
}

interface PredictionChartPoint {
  year: number
  actual?: number
  forecast?: number
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

function toPredictionChartData(
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
  yAxisWidth
}: {
  data: PredictionChartPoint[]
  latestYear: number | undefined
  yAxisWidth: number
}) {
  if (data.length < 2 || latestYear === undefined) {
    return <EmptyState label="Not enough historical data to generate a forecast chart." />
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
        <YAxis stroke="#94a3b8" tickLine={false} width={yAxisWidth} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
        <ReferenceLine
          x={latestYear}
          stroke="#f59e0b"
          strokeDasharray="4 4"
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#22d3ee"
          strokeWidth={3}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
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

function MetricsPanel({
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
      <dl className="mt-5 grid gap-4 text-sm md:grid-cols-3">
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

export default function PredictionsTab({
  populationSeries,
  gdpPerCapitaSeries
}: PredictionsTabProps): JSX.Element {
  const populationPrediction = useMemo(
    () => buildPrediction(populationSeries, 5),
    [populationSeries]
  )
  const gdpPrediction = useMemo(
    () => buildPrediction(gdpPerCapitaSeries, 5),
    [gdpPerCapitaSeries]
  )

  const latestPopulation = populationPrediction.historical[populationPrediction.historical.length - 1]
  const latestGdp = gdpPrediction.historical[gdpPrediction.historical.length - 1]
  const predictedPopulation = populationPrediction.forecast[populationPrediction.forecast.length - 1]
  const predictedGdp = gdpPrediction.forecast[gdpPrediction.forecast.length - 1]
  const populationGrowth = calculateGrowth(latestPopulation?.value ?? null, predictedPopulation?.value ?? null)
  const gdpGrowth = calculateGrowth(latestGdp?.value ?? null, predictedGdp?.value ?? null)

  const populationChartData = toPredictionChartData(populationPrediction, 1000000)
  const gdpChartData = toPredictionChartData(gdpPrediction)
  const hasPopulationForecast = populationPrediction.forecast.length > 0
  const hasGdpForecast = gdpPrediction.forecast.length > 0

  if (!hasPopulationForecast && !hasGdpForecast) {
    return (
      <EmptyState label="Prediction data is unavailable for this country because the World Bank time series is missing or too short." />
    )
  }

  return (
    <div className="space-y-6">
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
        <ChartPanel title="Population Forecast (millions)">
          {hasPopulationForecast ? (
            <PredictionChart
              data={populationChartData}
              latestYear={latestPopulation?.year}
              yAxisWidth={56}
            />
          ) : (
            <EmptyState label="Population forecast is unavailable." />
          )}
        </ChartPanel>
        <ChartPanel title="GDP Per Capita Forecast">
          {hasGdpForecast ? (
            <PredictionChart
              data={gdpChartData}
              latestYear={latestGdp?.year}
              yAxisWidth={72}
            />
          ) : (
            <EmptyState label="GDP per capita forecast is unavailable." />
          )}
        </ChartPanel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <MetricsPanel
          title="Population Model Evaluation"
          result={populationPrediction}
          valueFormatter={formatCompact}
        />
        <MetricsPanel
          title="GDP Model Evaluation"
          result={gdpPrediction}
          valueFormatter={formatCurrency}
        />
      </section>
    </div>
  )
}
