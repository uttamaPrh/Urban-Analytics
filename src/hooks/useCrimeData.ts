import { useQuery } from '@tanstack/react-query'
import { DataHookResult, PoliceCrimeItem, LatLng, BBox } from '@/types'

async function fetchCrimes(lat: number, lng: number, date: string) {
  const url = `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}&date=${date}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Police API failed')
  return (await res.json()) as PoliceCrimeItem[]
}

export function useCrimeData(bbox: BBox | null, months = 1): DataHookResult<PoliceCrimeItem[]> {
  const key = ['crime', bbox ? bbox.join(',') : 'global', months]

  const q = useQuery<PoliceCrimeItem[], Error>({
    queryKey: key,
    queryFn: async () => {
      if (!bbox) return []
      // sample 9 grid points (3x3)
      const [s, w, n, e] = bbox
      const lats = [s, (s + n) / 2, n]
      const lngs = [w, (w + e) / 2, e]
      const date = (() => {
        const d = new Date()
        d.setMonth(d.getMonth() - months)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })()
      const results: PoliceCrimeItem[] = []
      for (const lat of lats) {
        for (const lng of lngs) {
          const r = await fetchCrimes(lat, lng, date)
          for (const item of r) results.push(item)
        }
      }
      // dedupe by id
      const map = new Map<string, PoliceCrimeItem>()
      results.forEach((it) => map.set(it.id, it))
      return Array.from(map.values())
    },
    enabled: !!bbox,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5
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
