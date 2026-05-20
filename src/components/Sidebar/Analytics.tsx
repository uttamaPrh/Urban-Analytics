import React, { useState } from "react";
import { SelectedCountry } from "@/types";
import { usePopulationData } from "@/hooks/usePopulationData";
import { useCrimeData } from "@/hooks/useCrimeData";

interface AnalyticsProps {
  country: SelectedCountry;
}

type TabType = "population" | "crime";

export default function Analytics({ country }: AnalyticsProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>("population");
  const populationData = usePopulationData(country.code);
  const crimeData = useCrimeData(country.bbox ?? null, 3);

  const renderPopulation = () => {
    if (populationData.isLoading)
      return <div className="text-slate-300">Loading population data...</div>;
    if (populationData.isError)
      return <div className="text-red-400">Failed to load population data</div>;
    if (!populationData.data?.country)
      return <div className="text-slate-300">No data available</div>;

    const { country: data } = populationData.data;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600/50">
            <div className="text-slate-400 text-sm font-semibold mb-2">
              Total Population
            </div>
            <div className="text-3xl font-bold text-blue-400">
              {data.population
                ? (data.population / 1000000).toFixed(1) + "M"
                : "—"}
            </div>
          </div>
          <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600/50">
            <div className="text-slate-400 text-sm font-semibold mb-2">
              Area (km²)
            </div>
            <div className="text-3xl font-bold text-green-400">
              {data.area ? (data.area / 1000).toFixed(0) + "K" : "—"}
            </div>
          </div>
          <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600/50">
            <div className="text-slate-400 text-sm font-semibold mb-2">
              Population Density
            </div>
            <div className="text-3xl font-bold text-purple-400">
              {data.population && data.area
                ? (data.population / data.area).toFixed(0) + " per km²"
                : "—"}
            </div>
          </div>
        </div>
        <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600/50">
          <div className="text-slate-400 text-sm font-semibold mb-2">
            Capital
          </div>
          <div className="text-xl font-semibold text-white">
            {data.capital?.[0] ?? "—"}
          </div>
        </div>
        <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600/50">
          <div className="text-slate-400 text-sm font-semibold mb-2">
            Region
          </div>
          <div className="text-xl font-semibold text-white">
            {data.region ?? "—"}
          </div>
        </div>
      </div>
    );
  };

  const renderCrime = () => {
    if (!country.code?.toUpperCase().includes("GB")) {
      return (
        <div className="bg-amber-900/20 border border-amber-600/50 rounded-lg p-6 text-amber-200">
          <p className="font-semibold mb-2">Limited Data</p>
          <p>
            Crime data is currently only available for England, Wales & Northern
            Ireland via the UK Police API.
          </p>
        </div>
      );
    }

    if (crimeData.isLoading)
      return <div className="text-slate-300">Loading crime data...</div>;
    if (crimeData.isError)
      return <div className="text-red-400">Failed to load crime data</div>;
    if (!crimeData.data)
      return <div className="text-slate-300">No data available</div>;

    const counts: Record<string, number> = {};
    crimeData.data.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    const top5 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return (
      <div className="space-y-6">
        <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600/50">
          <div className="text-slate-400 text-sm font-semibold mb-2">
            Total Incidents
          </div>
          <div className="text-3xl font-bold text-red-400">
            {crimeData.data.length}
          </div>
        </div>
        <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600/50">
          <div className="text-slate-300 font-semibold mb-4">
            Top Crime Categories
          </div>
          <div className="space-y-3">
            {top5.map(([category, count]) => (
              <div key={category} className="flex justify-between items-center">
                <span className="text-slate-300">{category}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-600/50 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${(count / top5[0][1]) * 100}%` }}
                    />
                  </div>
                  <span className="text-slate-400 font-semibold w-8 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{country.name}</h1>
          <p className="text-slate-400">Urban Analytics Dashboard</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <button
            onClick={() => setActiveTab("population")}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === "population"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-slate-700 text-slate-200 hover:bg-slate-600"
            }`}
          >
            👥 Population
          </button>
          <button
            onClick={() => setActiveTab("crime")}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === "crime"
                ? "bg-red-600 text-white shadow-lg"
                : "bg-slate-700 text-slate-200 hover:bg-slate-600"
            }`}
          >
            🚨 Crime & Safety
          </button>
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
          {activeTab === "population" && renderPopulation()}
          {activeTab === "crime" && renderCrime()}
        </div>
      </div>
    </div>
  );
}
