import { LatLng, BBox } from '@/types'

export function bboxFromCoordinates(coords: number[][]): BBox {
  const lats = coords.map(c => c[1])
  const lngs = coords.map(c => c[0])
  return [Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)]
}

export function centroidOfCoords(coords: number[][]): LatLng {
  const lats = coords.map(c => c[1])
  const lngs = coords.map(c => c[0])
  const lat = lats.reduce((s, v) => s + v, 0) / lats.length
  const lng = lngs.reduce((s, v) => s + v, 0) / lngs.length
  return { lat, lng }
}

export function bboxToCenter(bbox: BBox): LatLng {
  const [s, w, n, e] = bbox
  return { lat: (s + n) / 2, lng: (w + e) / 2 }
}

export function expandBBox(bbox: BBox, factor = 0.1): BBox {
  const [s, w, n, e] = bbox
  const latPad = (n - s) * factor
  const lngPad = (e - w) * factor
  return [s - latPad, w - lngPad, n + latPad, e + lngPad]
}
