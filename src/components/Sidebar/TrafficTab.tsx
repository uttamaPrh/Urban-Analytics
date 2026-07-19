import React, { useState } from 'react'
import { useTrafficData } from '@/hooks/useTrafficData'
import { useTrafficClusters } from '@/hooks/useTrafficClusters'
import useAppStore from '@/store/useAppStore'

export default function TrafficTab(): JSX.Element {
  const bbox = useAppStore((s) => s.mapBBox)
  const { data, isLoading, isError, refetch } = useTrafficData(bbox)
  const [radius, setRadius] = useState<number>(500)

  const { clusters, isComputing } = useTrafficClusters(data, radius / 1000, 5)

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Traffic / Road Density</h3>
      <div className="mb-2">Radius: {radius} m</div>
      <input type="range" min={200} max={2000} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
      <div className="mt-4">
        {isLoading && <div>Loading roads...</div>}
        {!isLoading && isComputing && <div>Clustering roads...</div>}
        {isError && <div className="text-red-400">Failed to load roads <button onClick={() => refetch()}>Retry</button></div>}
        {data && <div>Road nodes: {data.length}</div>}
        {clusters.length > 0 && (
          <ul className="mt-2">
            {clusters.slice(0, 3).map((c) => (
              <li key={c.id}>Hotspot #{c.id + 1}: {c.count} segments</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
