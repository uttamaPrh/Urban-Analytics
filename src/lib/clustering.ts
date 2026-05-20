import { LatLng, Cluster } from '@/types'

// Haversine distance (km)
function haversine(a: LatLng, b: LatLng): number {
  const R = 6371 // km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const aa =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return R * c
}

export function dbscan(points: LatLng[], epsilon: number, minPoints: number): Cluster[] {
  const eps = epsilon // in km
  const visited = new Set<number>()
  const assigned = new Array<number | null>(points.length).fill(null)
  const clusters: Cluster[] = []

  function regionQuery(idx: number): number[] {
    const res: number[] = []
    for (let i = 0; i < points.length; i++) {
      if (haversine(points[idx], points[i]) <= eps) res.push(i)
    }
    return res
  }

  let cid = 0
  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue
    visited.add(i)
    const neighbors = regionQuery(i)
    if (neighbors.length < minPoints) {
      assigned[i] = -1 // noise
      continue
    }
    // new cluster
    const queue = [...neighbors]
    assigned[i] = cid
    const members = new Set<number>([i])
    while (queue.length) {
      const j = queue.shift() as number
      if (!visited.has(j)) {
        visited.add(j)
        const jNeighbors = regionQuery(j)
        if (jNeighbors.length >= minPoints) queue.push(...jNeighbors.filter(n => !visited.has(n)))
      }
      if (assigned[j] === null || assigned[j] === -1) {
        assigned[j] = cid
        members.add(j)
      }
    }

    // compute centroid and bounds
    const pts = Array.from(members).map(i => points[i])
    const latSum = pts.reduce((s, p) => s + p.lat, 0)
    const lngSum = pts.reduce((s, p) => s + p.lng, 0)
    const centroid = { lat: latSum / pts.length, lng: lngSum / pts.length }
    const lats = pts.map(p => p.lat)
    const lngs = pts.map(p => p.lng)
    const bounds = {
      south: Math.min(...lats),
      west: Math.min(...lngs),
      north: Math.max(...lats),
      east: Math.max(...lngs)
    }
    clusters.push({ id: cid, centroid, points: pts, count: pts.length, bounds })
    cid += 1
  }

  return clusters
}

export { haversine }
