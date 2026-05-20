import React from 'react'
import useAppStore from '@/store/useAppStore'
import { usePopulationData } from '@/hooks/usePopulationData'

export default function PopulationTab(): JSX.Element {
  const country = useAppStore((s) => s.selectedCountry)
  const code = country?.code
  const { data, isLoading, isError, refetch } = usePopulationData(code)

  return (
    <div>
      <h3 className="text-lg font-semibold">Population</h3>
      {isLoading && <div>Loading population data...</div>}
      {isError && <div className="text-red-400">Failed to load population <button onClick={()=>refetch()}>Retry</button></div>}
      {data && data.country && (
        <div className="mt-2">
          <div>Total population: {data.country.population ?? '—'}</div>
          <div>Area (km²): {data.country.area ?? '—'}</div>
          <div>Capital: {data.country.capital?.[0] ?? '—'}</div>
        </div>
      )}
    </div>
  )
}
