import { useQuery } from '@tanstack/react-query'
import { DataHookResult, RestCountry, WorldBankSeries } from '@/types'

const API_BASE_URL = import.meta.env.VITE_PREDICTION_API_URL ?? 'http://127.0.0.1:8001'

async function fetchRestCountry(code: string): Promise<RestCountry> {
  const res = await fetch(`${API_BASE_URL}/country/${encodeURIComponent(code)}`)
  if (!res.ok) throw new Error(`REST Countries proxy failed with HTTP ${res.status}`)
  const json = await res.json()
  if (!Array.isArray(json) || !json[0]) throw new Error('REST Countries proxy returned an unexpected response')
  return json[0] as RestCountry
}

async function fetchWorldBank(code: string, indicator: string): Promise<WorldBankSeries> {
  const res = await fetch(`https://api.worldbank.org/v2/country/${code}/indicator/${indicator}?format=json&per_page=500`)
  if (!res.ok) throw new Error('World Bank failed')
  const json = await res.json()
  // json[1] contains time series
  return (json[1] ?? []) as WorldBankSeries
}

export interface PopulationBundle {
  country: RestCountry | null
  populationSeries: WorldBankSeries | null
  areaSeries: WorldBankSeries | null
  urbanPopulationSeries: WorldBankSeries | null
  gdpPerCapitaSeries: WorldBankSeries | null
}

export function usePopulationData(code: string | undefined): DataHookResult<PopulationBundle> {
  const key = ['population', code || 'none']
  const q = useQuery<PopulationBundle, Error>({
    queryKey: key,
    queryFn: async () => {
      if (!code) {
        return {
          country: null,
          populationSeries: null,
          areaSeries: null,
          urbanPopulationSeries: null,
          gdpPerCapitaSeries: null
        }
      }
      const wbCode = code.toLowerCase()
      const [
        country,
        populationSeries,
        areaSeries,
        urbanPopulationSeries,
        gdpPerCapitaSeries
      ] = await Promise.all([
        fetchRestCountry(code).catch(() => null),
        fetchWorldBank(wbCode, 'SP.POP.TOTL'),
        fetchWorldBank(wbCode, 'AG.SRF.TOTL.K2'),
        fetchWorldBank(wbCode, 'SP.URB.TOTL.IN.ZS'),
        fetchWorldBank(wbCode, 'NY.GDP.PCAP.CD')
      ])
      return {
        country,
        populationSeries,
        areaSeries,
        urbanPopulationSeries,
        gdpPerCapitaSeries
      }
    },
    enabled: !!code,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6
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
