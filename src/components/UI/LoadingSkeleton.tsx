import React from 'react'

export default function LoadingSkeleton({ rows = 3 }: { rows?: number }): JSX.Element {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-700 rounded animate-pulse" />
      ))}
    </div>
  )
}
