import React, { useState } from 'react'
import useAppStore from '@/store/useAppStore'
import { useCrimeData } from '@/hooks/useCrimeData'

export default function CrimeTab(): JSX.Element {
  const bbox = useAppStore((s) => s.mapBBox)
  const country = useAppStore((s) => s.selectedCountry)
  const [months, setMonths] = useState<number>(1)
  const { data, isLoading, isError, refetch } = useCrimeData(bbox, months)

  if (!country || country.code?.toUpperCase() !== 'GB') {
    return (
      <div>
        <h3 className="text-lg font-semibold">Crime / Safety</h3>
        <div className="mt-4 p-3 bg-slate-800 rounded">Crime data is currently only available for England, Wales & Northern Ireland via the UK Police API.</div>
      </div>
    )
  }

  const counts = data ? data.reduce((acc: Record<string, number>, it) => { acc[it.category] = (acc[it.category] || 0) + 1; return acc }, {}) : {}
  const top5 = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5)

  return (
    <div>
      <h3 className="text-lg font-semibold">Crime / Safety</h3>
      <div className="mt-2">Date range: <select value={months} onChange={(e)=>setMonths(Number(e.target.value))}><option value={1}>1 month</option><option value={3}>3 months</option><option value={6}>6 months</option></select></div>
      {isLoading && <div>Loading incidents...</div>}
      {isError && <div className="text-red-400">Failed to load crimes <button onClick={()=>refetch()}>Retry</button></div>}
      {data && <div className="mt-2">Total incidents: {data.length}</div>}
      {top5.length>0 && (
        <ul className="mt-2">
          {top5.map(([cat, count])=> <li key={cat}>{cat}: {count}</li>)}
        </ul>
      )}
    </div>
  )
}
