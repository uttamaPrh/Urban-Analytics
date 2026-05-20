import { useQuery } from '@tanstack/react-query'
import { DataHookResult, OpenAQLocation, BBox } from '@/types'

async function fetchOpenAQLocations(bbox: BBox): Promise<OpenAQLocation[]> {
  const [s, w, n, e] = bbox
  const bboxStr = `${w},${s},${e},${n}` // W,S,E,N per API
  const url = `https://api.openaq.org/v3/locations?bbox=${bboxStr}&limit=100`
  const res = await fetch(url)
  if (!res.ok) throw new Error('OpenAQ failed')
  const json = await res.json()
  return json.results as OpenAQLocation[]
}

export function useAQIData(bbox: BBox | null): DataHookResult<OpenAQLocation[]> {
  const key = ['aqi', bbox ? bbox.join(',') : 'global']
  const q = useQuery<OpenAQLocation[], Error>({
    queryKey: key,
    queryFn: async () => {
      if (!bbox) return []
      return await fetchOpenAQLocations(bbox)
    },
    enabled: !!bbox,
    staleTime: 1000 * 60 * 2,
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
