import React from 'react'
import useAppStore from '@/store/useAppStore'

export default function Navbar(): JSX.Element {
  const country = useAppStore((s) => s.selectedCountry)
  const clear = useAppStore((s) => s.clearSelectedCountry)

  return (
    <header className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between text-white">
      <div className="flex items-center gap-3">
        <button onClick={() => clear()} className="px-2 py-1 bg-slate-800 rounded">← Globe</button>
        {country ? (
          <div className="flex items-center gap-2"><span>{country.code ?? '🌍'}</span><strong>{country.name}</strong></div>
        ) : (
          <div className="text-sm opacity-70">Globe view</div>
        )}
      </div>
      <div className="opacity-70">Urban Analytics</div>
    </header>
  )
}
