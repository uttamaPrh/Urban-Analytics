import { useQuery } from '@tanstack/react-query'
import { CountriesGeoJSON, DataHookResult } from '@/types'

const GEOJSON_PATH = '/countries.geojson'

async function fetchCountriesGeoJSON(): Promise<CountriesGeoJSON> {
  const res = await fetch(GEOJSON_PATH)
  if (!res.ok) throw new Error('Failed to fetch countries GeoJSON')
  return res.json()
}

export function useCountriesGeoJSON(): DataHookResult<CountriesGeoJSON> {
  const q = useQuery<CountriesGeoJSON, Error>({
    queryKey: ['countries-geojson'],
    queryFn: fetchCountriesGeoJSON,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2 // 2 hours
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
