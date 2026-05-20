import React, { useState } from 'react'
import useAppStore from '@/store/useAppStore'
import { useAQIData } from '@/hooks/useAQIData'
import AQILegend from '@/components/UI/AQILegend'

export default function AQITab(): JSX.Element {
  const bbox = useAppStore((s) => s.mapBBox)
  const { data, isLoading, isError, refetch } = useAQIData(bbox)
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div>
      <h3 className="text-lg font-semibold">Air Quality (OpenAQ)</h3>
      {isLoading && <div>Loading stations...</div>}
      {isError && <div className="text-red-400">Failed to load AQI <button onClick={()=>refetch()}>Retry</button></div>}
      <AQILegend />
      {data && <div className="mt-2">Stations: {data.length}</div>}
      {selected !== null && <div className="mt-2">Selected station ID: {selected}</div>}
    </div>
  )
}
