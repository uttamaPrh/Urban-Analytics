import { LatLng, BBox } from '@/types'

export function bboxFromCoordinates(coords: number[][]): BBox {
  let south = Number.POSITIVE_INFINITY
  let west = Number.POSITIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY

  for (let index = 0; index < coords.length; index += 1) {
    const coordinate = coords[index]
    const lng = coordinate[0]
    const lat = coordinate[1]
    if (lat < south) south = lat
    if (lng < west) west = lng
    if (lat > north) north = lat
    if (lng > east) east = lng
  }

  return [south, west, north, east]
}

export function centroidOfCoords(coords: number[][]): LatLng {
  let latSum = 0
  let lngSum = 0

  for (let index = 0; index < coords.length; index += 1) {
    const coordinate = coords[index]
    lngSum += coordinate[0]
    latSum += coordinate[1]
  }

  const lat = latSum / coords.length
  const lng = lngSum / coords.length
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
