import { useQuery } from '@tanstack/react-query'
import { DataHookResult, RestCountry, WorldBankSeries } from '@/types'

async function fetchRestCountry(code: string): Promise<RestCountry> {
  const res = await fetch(`https://restcountries.com/v3.1/alpha/${code}`)
  if (!res.ok) throw new Error('REST Countries failed')
  const json = await res.json()
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
}

export function usePopulationData(code: string | undefined): DataHookResult<PopulationBundle> {
  const key = ['population', code || 'none']
  const q = useQuery<PopulationBundle, Error>({
    queryKey: key,
    queryFn: async () => {
      if (!code) return { country: null, populationSeries: null, areaSeries: null }
      const country = await fetchRestCountry(code)
      const populationSeries = await fetchWorldBank(code.toLowerCase(), 'SP.POP.TOTL')
      const areaSeries = await fetchWorldBank(code.toLowerCase(), 'AG.SRF.TOTL.K2')
      return { country, populationSeries, areaSeries }
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
