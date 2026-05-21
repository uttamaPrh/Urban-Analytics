import React, { useState } from 'react'
import useAppStore from '@/store/useAppStore'
import { useCrimeData } from '@/hooks/useCrimeData'

export default function CrimeTab(): JSX.Element {
  const bbox = useAppStore((s) => s.mapBBox)
  const country = useAppStore((s) => s.selectedCountry)
  const [months, setMonths] = useState<number>(1)
  const { data, isLoading, isError, refetch } = useCrimeData(bbox, months, country?.code)

  const counts = data ? data.incidents.reduce((acc: Record<string, number>, it) => { acc[it.category] = (acc[it.category] || 0) + 1; return acc }, {}) : {}
  const top5 = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const homicide = data?.indicators.find((item) => item.indicator === 'VC.IHR.PSRC.P5')

  return (
    <div>
      <h3 className="text-lg font-semibold">Crime / Safety</h3>
      <div className="mt-2">Date range: <select value={months} onChange={(e)=>setMonths(Number(e.target.value))}><option value={1}>1 month</option><option value={3}>3 months</option><option value={6}>6 months</option></select></div>
      {isLoading && <div>Loading incidents...</div>}
      {isError && <div className="text-red-400">Failed to load crimes <button onClick={()=>refetch()}>Retry</button></div>}
      {data && (
        <div className="mt-2 space-y-2">
          <div>Local incidents: {data.incidents.length}</div>
          <div>
            Global homicide rate: {homicide?.latestValue ? homicide.latestValue.toFixed(1) : 'n/a'} per 100k
            {homicide?.latestYear ? ` (${homicide.latestYear})` : ''}
          </div>
        </div>
      )}
      {top5.length>0 && (
        <ul className="mt-2">
          {top5.map(([cat, count])=> <li key={cat}>{cat}: {count}</li>)}
        </ul>
      )}
      {data && top5.length === 0 && <div className="mt-2 text-slate-300">Using global country-level safety indicators for this location.</div>}
    </div>
  )
}
