import { useQuery } from '@tanstack/react-query'
import {
  CrimeDataBundle,
  DataHookResult,
  GlobalCrimeIndicator,
  PoliceCrimeItem,
  BBox,
  WorldBankSeries
} from '@/types'

async function fetchCrimes(lat: number, lng: number, date: string) {
  const url = `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}&date=${date}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Police API failed')
  return (await res.json()) as PoliceCrimeItem[]
}

async function fetchWorldBank(code: string, indicator: string): Promise<WorldBankSeries> {
  const res = await fetch(`https://api.worldbank.org/v2/country/${code}/indicator/${indicator}?format=json&per_page=500`)
  if (!res.ok) throw new Error('World Bank failed')
  const json = await res.json()
  return (json[1] ?? []) as WorldBankSeries
}

function toIndicator(
  indicator: string,
  label: string,
  unit: string,
  series: WorldBankSeries
): GlobalCrimeIndicator {
  const cleanSeries = series
    .filter((point) => point.value !== null)
    .map((point) => ({ year: point.date, value: Number(point.value) }))
    .filter((point) => Number.isFinite(point.value))
    .sort((a, b) => Number(a.year) - Number(b.year))

  const latest = cleanSeries[cleanSeries.length - 1]

  return {
    indicator,
    label,
    unit,
    latestYear: latest?.year ?? null,
    latestValue: latest?.value ?? null,
    series: cleanSeries
  }
}

async function fetchGlobalCrimeIndicators(code: string): Promise<GlobalCrimeIndicator[]> {
  const wbCode = code.toLowerCase()
  const [homicideSeries, theftLossSeries] = await Promise.all([
    fetchWorldBank(wbCode, 'VC.IHR.PSRC.P5'),
    fetchWorldBank(wbCode, 'IC.FRM.CRIM.ZS')
  ])

  return [
    toIndicator(
      'VC.IHR.PSRC.P5',
      'Intentional homicide rate',
      'per 100k people',
      homicideSeries
    ),
    toIndicator(
      'IC.FRM.CRIM.ZS',
      'Business losses from crime',
      '% of annual sales',
      theftLossSeries
    )
  ]
}

export function useCrimeData(
  bbox: BBox | null,
  months = 1,
  countryCode?: string
): DataHookResult<CrimeDataBundle> {
  const normalizedCode = countryCode?.toUpperCase()
  const isUkPoliceSupported = normalizedCode === 'GB'
  const key = ['crime', normalizedCode || 'none', bbox ? bbox.join(',') : 'global', months]

  const q = useQuery<CrimeDataBundle, Error>({
    queryKey: key,
    queryFn: async () => {
      const indicators = normalizedCode
        ? await fetchGlobalCrimeIndicators(normalizedCode)
        : []

      if (!bbox || !isUkPoliceSupported) {
        return {
          incidents: [],
          indicators,
          source: 'world-bank'
        }
      }

      try {
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
        return {
          incidents: Array.from(map.values()),
          indicators,
          source: 'mixed'
        }
      } catch {
        return {
          incidents: [],
          indicators,
          source: 'world-bank'
        }
      }
    },
    enabled: !!normalizedCode,
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
