import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { SelectedCountry, WorldBankSeries } from "@/types";
import { usePopulationData } from "@/hooks/usePopulationData";
import { useCrimeData } from "@/hooks/useCrimeData";

interface AnalyticsProps {
  country: SelectedCountry;
}

type TabType = "overview" | "population" | "economy" | "crime";

const tabs: Array<{ id: TabType; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "population", label: "Population" },
  { id: "economy", label: "Economy" },
  { id: "crime", label: "Crime & Safety" }
];

const chartColors = {
  cyan: "#22d3ee",
  green: "#34d399",
  amber: "#f59e0b",
  red: "#fb7185"
};

function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function latestValue(series: WorldBankSeries | null | undefined): number | null {
  const point = series?.find((item) => item.value !== null);
  return point ? Number(point.value) : null;
}

function toChartData(
  series: WorldBankSeries | null | undefined,
  years = 12,
  scale = 1
): Array<{ year: string; value: number }> {
  return (series ?? [])
    .filter((point) => point.value !== null)
    .map((point) => ({ year: point.date, value: Number(point.value) / scale }))
    .filter((point) => Number.isFinite(point.value))
    .sort((a, b) => Number(a.year) - Number(b.year))
    .slice(-years);
}

function KpiCard({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "green" | "amber" | "red";
}) {
  const tones = {
    cyan: "from-cyan-500/20 to-sky-500/5 border-cyan-300/20 text-cyan-200",
    green: "from-emerald-500/20 to-teal-500/5 border-emerald-300/20 text-emerald-200",
    amber: "from-amber-500/20 to-orange-500/5 border-amber-300/20 text-amber-200",
    red: "from-rose-500/20 to-red-500/5 border-rose-300/20 text-rose-200"
  };

  return (
    <div className={`rounded-lg border bg-gradient-to-br p-5 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
        {label}
      </div>
      <div className="mt-3 text-3xl font-bold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{detail}</div>
    </div>
  );
}

function ChartPanel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-5">
      <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">
        {title}
      </div>
      <div className="h-72">{children}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-950/40 text-sm text-slate-400">
      {label}
    </div>
  );
}

function IndicatorBars({
  indicators
}: {
  indicators: Array<{
    label: string;
    unit: string;
    latestYear: string | null;
    latestValue: number | null;
  }>;
}) {
  const max = Math.max(
    ...indicators.map((item) => item.latestValue ?? 0),
    1
  );

  return (
    <div className="space-y-5">
      {indicators.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-end justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">{item.label}</div>
              <div className="text-xs text-slate-400">{item.latestYear ?? "Latest available"}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-rose-200">
                {item.latestValue !== null ? item.latestValue.toFixed(1) : "-"}
              </div>
              <div className="text-xs text-slate-400">{item.unit}</div>
            </div>
          </div>
          <div className="h-3 rounded-full bg-slate-800">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-rose-500 to-amber-300"
              style={{
                width: `${Math.max(((item.latestValue ?? 0) / max) * 100, item.latestValue ? 8 : 0)}%`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics({ country }: AnalyticsProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const populationData = usePopulationData(country.code);
  const crimeData = useCrimeData(country.bbox ?? null, 3, country.code);

  const data = populationData.data;
  const countryData = data?.country;
  const populationTrend = useMemo(
    () => toChartData(data?.populationSeries, 14, 1000000),
    [data?.populationSeries]
  );
  const urbanTrend = useMemo(
    () => toChartData(data?.urbanPopulationSeries, 14),
    [data?.urbanPopulationSeries]
  );
  const gdpTrend = useMemo(
    () => toChartData(data?.gdpPerCapitaSeries, 14),
    [data?.gdpPerCapitaSeries]
  );
  const homicideTrend = crimeData.data?.indicators[0]?.series.slice(-14) ?? [];
  const businessCrimeTrend = crimeData.data?.indicators[1]?.series.slice(-14) ?? [];

  const latestPopulation = latestValue(data?.populationSeries) ?? countryData?.population;
  const latestUrban = latestValue(data?.urbanPopulationSeries);
  const latestGdp = latestValue(data?.gdpPerCapitaSeries);
  const latestHomicide = crimeData.data?.indicators[0]?.latestValue ?? null;

  const crimeCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    crimeData.data?.incidents.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category, count]) => ({ category, count }));
  }, [crimeData.data?.incidents]);

  const isLoading = populationData.isLoading || crimeData.isLoading;

  return (
    <div className="min-h-screen bg-[#0a1020] px-5 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
              Urban Analytics Dashboard
            </div>
            <h1 className="mt-2 text-4xl font-bold">{country.name}</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Country-scale indicators, trends, and safety signals from global open data sources.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {isLoading && (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-6 text-slate-300">
            Loading analytics...
          </div>
        )}

        {!isLoading && populationData.isError && (
          <div className="rounded-lg border border-red-400/30 bg-red-950/30 p-6 text-red-200">
            Failed to load population and economic indicators.
          </div>
        )}

        {!isLoading && countryData && (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Population"
                value={formatCompact(latestPopulation)}
                detail={countryData.capital?.[0] ? `Capital: ${countryData.capital[0]}` : "Latest available"}
                tone="cyan"
              />
              <KpiCard
                label="Urbanization"
                value={latestUrban ? `${latestUrban.toFixed(1)}%` : "-"}
                detail="Urban population share"
                tone="green"
              />
              <KpiCard
                label="GDP per capita"
                value={formatCurrency(latestGdp)}
                detail="Current US dollars"
                tone="amber"
              />
              <KpiCard
                label="Homicide rate"
                value={latestHomicide ? latestHomicide.toFixed(1) : "-"}
                detail="Per 100k people"
                tone="red"
              />
            </section>

            {activeTab === "overview" && (
              <section className="grid gap-4 lg:grid-cols-2">
                <ChartPanel title="Population Trend (millions)">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={populationTrend}>
                      <CartesianGrid stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
                      <YAxis stroke="#94a3b8" tickLine={false} width={48} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                      <Area dataKey="value" stroke={chartColors.cyan} fill={chartColors.cyan} fillOpacity={0.18} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartPanel>
                <ChartPanel title="Urban Population Share">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={urbanTrend}>
                      <CartesianGrid stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
                      <YAxis stroke="#94a3b8" tickLine={false} width={48} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                      <Line type="monotone" dataKey="value" stroke={chartColors.green} strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartPanel>
              </section>
            )}

            {activeTab === "population" && (
              <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
                <ChartPanel title="Population Trend (millions)">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={populationTrend}>
                      <CartesianGrid stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
                      <YAxis stroke="#94a3b8" tickLine={false} width={48} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                      <Bar dataKey="value" fill={chartColors.cyan} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartPanel>
                <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-5">
                  <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Country Profile
                  </div>
                  <dl className="mt-5 space-y-4 text-sm">
                    <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
                      <dt className="text-slate-400">Region</dt>
                      <dd className="font-semibold">{countryData.region ?? "-"}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
                      <dt className="text-slate-400">Subregion</dt>
                      <dd className="font-semibold">{countryData.subregion ?? "-"}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-800 pb-3">
                      <dt className="text-slate-400">Area</dt>
                      <dd className="font-semibold">{formatCompact(countryData.area)} km2</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">Density</dt>
                      <dd className="font-semibold">
                        {latestPopulation && countryData.area
                          ? `${Math.round(latestPopulation / countryData.area)} / km2`
                          : "-"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}

            {activeTab === "economy" && (
              <section className="grid gap-4 lg:grid-cols-2">
                <ChartPanel title="GDP Per Capita">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={gdpTrend}>
                      <CartesianGrid stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
                      <YAxis stroke="#94a3b8" tickLine={false} width={64} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                      <Area dataKey="value" stroke={chartColors.amber} fill={chartColors.amber} fillOpacity={0.18} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartPanel>
                <ChartPanel title="Urbanization Trend">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={urbanTrend}>
                      <CartesianGrid stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
                      <YAxis stroke="#94a3b8" tickLine={false} width={48} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                      <Line type="monotone" dataKey="value" stroke={chartColors.green} strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartPanel>
              </section>
            )}

            {activeTab === "crime" && (
              <section className="grid gap-4 lg:grid-cols-2">
                <ChartPanel title="Global Homicide Rate">
                  {homicideTrend.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={homicideTrend}>
                        <CartesianGrid stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} width={48} />
                        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                        <Area dataKey="value" stroke={chartColors.red} fill={chartColors.red} fillOpacity={0.18} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="No homicide trend available for this country" />
                  )}
                </ChartPanel>
                <ChartPanel title="Business Crime Impact">
                  {businessCrimeTrend.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={businessCrimeTrend}>
                        <CartesianGrid stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} width={48} />
                        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                        <Bar dataKey="value" fill={chartColors.amber} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="No business crime trend available for this country" />
                  )}
                </ChartPanel>
                <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-5 lg:col-span-2">
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                      Safety Indicators
                    </div>
                    <div className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-300">
                      Local incidents sampled: <span className="font-bold text-white">{crimeData.data?.incidents.length ?? 0}</span>
                    </div>
                  </div>
                  <IndicatorBars indicators={crimeData.data?.indicators ?? []} />
                  {crimeCategories.length > 0 && (
                    <div className="mt-7 space-y-3">
                      <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                        Local Incident Categories
                      </div>
                      {crimeCategories.map((item) => (
                        <div key={item.category}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="text-slate-300">{item.category}</span>
                            <span className="font-semibold">{item.count}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800">
                            <div
                              className="h-2 rounded-full bg-rose-400"
                              style={{
                                width: `${(item.count / crimeCategories[0].count) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {crimeData.isError && (
                    <div className="mt-4 rounded-md border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">
                      Failed to load global safety indicators.
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
