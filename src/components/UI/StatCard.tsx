import React from 'react'

interface StatCardProps {
  title: string
  value: string | number
}

export default function StatCard({ title, value }: StatCardProps): JSX.Element {
  return (
    <div className="p-3 bg-slate-800/60 rounded-md">
      <div className="text-sm text-slate-300">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}
