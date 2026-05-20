import { LatLng } from '@/types'

export const aqiColor = (aqi: number): string => {
  if (aqi <= 50) return '#16a34a' // green
  if (aqi <= 100) return '#f59e0b' // yellow
  if (aqi <= 150) return '#fb923c' // orange
  if (aqi <= 200) return '#ef4444' // red
  return '#7c3aed' // purple
}

export const densityColor = (value: number, max = 100): string => {
  const v = Math.min(value / max, 1)
  // gradient green -> amber -> red
  if (v < 0.5) {
    // green to amber
    const t = v / 0.5
    return interpolateColor('#16a34a', '#f59e0b', t)
  }
  const t = (v - 0.5) / 0.5
  return interpolateColor('#f59e0b', '#ef4444', t)
}

function interpolateColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a)
  const pb = hexToRgb(b)
  if (!pa || !pb) return a
  const r = Math.round(pa.r + (pb.r - pa.r) * t)
  const g = Math.round(pa.g + (pb.g - pa.g) * t)
  const bl = Math.round(pa.b + (pb.b - pa.b) * t)
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '')
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16)
    const g = parseInt(m[1] + m[1], 16)
    const b = parseInt(m[2] + m[2], 16)
    return { r, g, b }
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16)
    const g = parseInt(m.slice(2, 4), 16)
    const b = parseInt(m.slice(4, 6), 16)
    return { r, g, b }
  }
  return null
}

function toHex(n: number): string {
  const s = n.toString(16)
  return s.length === 1 ? '0' + s : s
}
