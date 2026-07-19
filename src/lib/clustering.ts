import { Cluster, LatLng } from '@/types'

const EARTH_RADIUS_KM = 6371
const DEG_TO_RAD = Math.PI / 180

function toRadians(value: number): number {
  return value * DEG_TO_RAD
}

// Haversine distance (km)
function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)))
}

function regionQuery(points: LatLng[], idx: number, epsilonKm: number): number[] {
  const neighbors: number[] = []
  const origin = points[idx]

  for (let index = 0; index < points.length; index += 1) {
    if (haversine(origin, points[index]) <= epsilonKm) {
      neighbors.push(index)
    }
  }

  return neighbors
}

function buildCluster(points: LatLng[], memberIndices: number[], cid: number): Cluster {
  const clusterPoints = new Array<LatLng>(memberIndices.length)
  let latSum = 0
  let lngSum = 0
  let south = Number.POSITIVE_INFINITY
  let west = Number.POSITIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY

  for (let index = 0; index < memberIndices.length; index += 1) {
    const point = points[memberIndices[index]]
    clusterPoints[index] = point
    latSum += point.lat
    lngSum += point.lng
    if (point.lat < south) south = point.lat
    if (point.lng < west) west = point.lng
    if (point.lat > north) north = point.lat
    if (point.lng > east) east = point.lng
  }

  return {
    id: cid,
    centroid: {
      lat: latSum / clusterPoints.length,
      lng: lngSum / clusterPoints.length,
    },
    points: clusterPoints,
    count: clusterPoints.length,
    bounds: { south, west, north, east },
  }
}

export function dbscan(points: LatLng[], epsilon: number, minPoints: number): Cluster[] {
  const eps = epsilon
  const visited = new Set<number>()
  const assigned = new Array<number | null>(points.length).fill(null)
  const clusters: Cluster[] = []

  let cid = 0
  for (let index = 0; index < points.length; index += 1) {
    if (visited.has(index)) continue
    visited.add(index)

    const neighbors = regionQuery(points, index, eps)
    if (neighbors.length < minPoints) {
      assigned[index] = -1
      continue
    }

    const queue = neighbors.slice()
    const members: number[] = [index]
    assigned[index] = cid

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const neighborIndex = queue[queueIndex]
      if (!visited.has(neighborIndex)) {
        visited.add(neighborIndex)
        const neighborNeighbors = regionQuery(points, neighborIndex, eps)
        if (neighborNeighbors.length >= minPoints) {
          for (let i = 0; i < neighborNeighbors.length; i += 1) {
            const candidate = neighborNeighbors[i]
            if (!visited.has(candidate)) {
              queue.push(candidate)
            }
          }
        }
      }

      if (assigned[neighborIndex] === null || assigned[neighborIndex] === -1) {
        assigned[neighborIndex] = cid
        members.push(neighborIndex)
      }
    }

    clusters.push(buildCluster(points, members, cid))
    cid += 1
  }

  return clusters
}

function yieldToMainThread(): Promise<void> {
  const idleCallback = (globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }).requestIdleCallback

  if (typeof idleCallback === 'function') {
    return new Promise((resolve) => {
      idleCallback(() => resolve(), { timeout: 16 })
    })
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, 0)
  })
}

export async function dbscanAsync(points: LatLng[], epsilon: number, minPoints: number): Promise<Cluster[]> {
  const eps = epsilon
  const visited = new Set<number>()
  const assigned = new Array<number | null>(points.length).fill(null)
  const clusters: Cluster[] = []

  let cid = 0
  let workCounter = 0

  const maybeYield = async () => {
    workCounter += 1
    if (workCounter >= 8) {
      workCounter = 0
      await yieldToMainThread()
    }
  }

  for (let index = 0; index < points.length; index += 1) {
    if (visited.has(index)) continue
    visited.add(index)

    const neighbors = regionQuery(points, index, eps)
    await maybeYield()

    if (neighbors.length < minPoints) {
      assigned[index] = -1
      continue
    }

    const queue = neighbors.slice()
    const members: number[] = [index]
    assigned[index] = cid

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const neighborIndex = queue[queueIndex]
      if (!visited.has(neighborIndex)) {
        visited.add(neighborIndex)
        const neighborNeighbors = regionQuery(points, neighborIndex, eps)
        await maybeYield()

        if (neighborNeighbors.length >= minPoints) {
          for (let i = 0; i < neighborNeighbors.length; i += 1) {
            const candidate = neighborNeighbors[i]
            if (!visited.has(candidate)) {
              queue.push(candidate)
            }
          }
        }
      }

      if (assigned[neighborIndex] === null || assigned[neighborIndex] === -1) {
        assigned[neighborIndex] = cid
        members.push(neighborIndex)
      }
    }

    clusters.push(buildCluster(points, members, cid))
    cid += 1
    await maybeYield()
  }

  return clusters
}

export { haversine }
