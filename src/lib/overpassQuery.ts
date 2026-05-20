import { BBox } from '@/types'

export function buildOverpassRoadsQuery(bbox: BBox): string {
  const [s, w, n, e] = bbox
  // Overpass QL expects: South, West, North, East
  return `[out:json][timeout:25][bbox:${s},${w},${n},${e}];\n(way[highway];);\nout body;\n>;\nout skel qt;`
}
