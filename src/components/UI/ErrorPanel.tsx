import React from 'react'

export default function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div className="p-3 bg-red-900/50 rounded text-white">
      <div className="font-semibold">Error</div>
      <div className="text-sm">{message}</div>
      {onRetry && <button className="mt-2 px-3 py-1 bg-white text-black rounded" onClick={onRetry}>Retry</button>}
    </div>
  )
}
