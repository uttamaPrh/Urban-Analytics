import React from 'react'

export default function AQILegend(): JSX.Element {
  const bands = [
    { label: '0-50 Good', color: '#16a34a' },
    { label: '51-100 Moderate', color: '#f59e0b' },
    { label: '101-150 Unhealthy for Sensitive', color: '#fb923c' },
    { label: '151-200 Unhealthy', color: '#ef4444' },
    { label: '201+ Hazardous', color: '#7c3aed' }
  ]
  return (
    <div className="mt-2 p-2 bg-slate-800/60 rounded">
      <div className="text-sm mb-2">AQI Legend</div>
      <div className="flex gap-2">
        {bands.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <div style={{ width: 18, height: 12, background: b.color, borderRadius: 2 }} />
            <div className="text-xs">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
