import { useQuery } from '@tanstack/react-query'
import { OverpassResponse, DataHookResult, LatLng, BBox } from '@/types'
import { buildOverpassRoadsQuery } from '@/lib/overpassQuery'

async function fetchOverpass(bbox: BBox): Promise<OverpassResponse> {
  const q = buildOverpassRoadsQuery(bbox)
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: q
  })
  if (!res.ok) throw new Error('Overpass request failed')
  return res.json()
}

export function useTrafficData(bbox: BBox | null): DataHookResult<LatLng[]> {
  const key = ['traffic', bbox ? bbox.join(',') : 'global']
  const q = useQuery<LatLng[], Error>({
    queryKey: key,
    queryFn: async () => {
      if (!bbox) return []
      const json = await fetchOverpass(bbox)
      // extract node coordinates from ways
      const coords: LatLng[] = []
      for (const el of json.elements) {
        if (el.type === 'node') coords.push({ lat: el.lat, lng: el.lon })
        if (el.type === 'way' && el.geometry) {
          for (const g of el.geometry) coords.push({ lat: g.lat, lng: g.lon })
        }
      }
      return coords
    },
    enabled: !!bbox,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10
  })

  return {
    data: q.data ?? null,
    isLoading: q.isLoading,
    isError: !!q.error,
    refetch: async () => {
      await q.refetch()
    }
  }
}
