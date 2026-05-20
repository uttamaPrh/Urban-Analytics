import React from 'react'
import useAppStore from '@/store/useAppStore'
import TrafficTab from './TrafficTab'
import CrimeTab from './CrimeTab'
import AQITab from './AQITab'
import PopulationTab from './PopulationTab'

export default function Sidebar(): JSX.Element {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  return (
    <aside className="fixed left-4 top-16 bottom-4 z-40 w-96 bg-slate-900/80 backdrop-blur-md p-4 rounded-lg transition-all duration-300 text-white shadow-2xl">
      <div className="flex gap-2 mb-4">
        <button className={`px-3 py-1 rounded ${activeTab === 'traffic' ? 'bg-slate-700' : ''}`} onClick={() => setActiveTab('traffic')}>Traffic</button>
        <button className={`px-3 py-1 rounded ${activeTab === 'crime' ? 'bg-slate-700' : ''}`} onClick={() => setActiveTab('crime')}>Crime</button>
        <button className={`px-3 py-1 rounded ${activeTab === 'aqi' ? 'bg-slate-700' : ''}`} onClick={() => setActiveTab('aqi')}>AQI</button>
        <button className={`px-3 py-1 rounded ${activeTab === 'population' ? 'bg-slate-700' : ''}`} onClick={() => setActiveTab('population')}>Population</button>
      </div>
      <div className="overflow-auto h-[calc(100%-64px)]">
        {activeTab === 'traffic' && <TrafficTab />}
        {activeTab === 'crime' && <CrimeTab />}
        {activeTab === 'aqi' && <AQITab />}
        {activeTab === 'population' && <PopulationTab />}
      </div>
    </aside>
  )
}
