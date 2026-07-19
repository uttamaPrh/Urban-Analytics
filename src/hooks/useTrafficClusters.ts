import { useEffect, useState } from 'react'
import { dbscanAsync } from '@/lib/clustering'
import { Cluster, LatLng } from '@/types'

export function useTrafficClusters(
  points: LatLng[] | null | undefined,
  epsilonKm: number,
  minPoints: number
): { clusters: Cluster[]; isComputing: boolean } {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [isComputing, setIsComputing] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!points || points.length === 0) {
      setClusters([])
      setIsComputing(false)
      return () => {
        cancelled = true
      }
    }

    setIsComputing(true)

    void dbscanAsync(points, epsilonKm, minPoints)
      .then((result) => {
        if (cancelled) return
        setClusters(result)
        setIsComputing(false)
      })
      .catch(() => {
        if (cancelled) return
        setClusters([])
        setIsComputing(false)
      })

    return () => {
      cancelled = true
    }
  }, [points, epsilonKm, minPoints])

  return { clusters, isComputing }
}