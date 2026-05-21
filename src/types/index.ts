// Shared application types

export type LatLng = {
  lat: number
  lng: number
}

export type BBox = [south: number, west: number, north: number, east: number]

export interface DataHookResult<T> {
  data: T | null
  isLoading: boolean
  isError: boolean
  refetch: () => Promise<void>
}

// Countries GeoJSON (Natural Earth features)
export interface GeoJSONGeometry {
  type: string
  coordinates: any
}

export interface CountryProperties {
  NAME: string
  NAME_LONG?: string
  ADM0_A3?: string
  ISO_A3?: string
  [key: string]: unknown
}

export interface CountryFeature {
  type: 'Feature'
  geometry: GeoJSONGeometry
  properties: CountryProperties
}

export interface CountriesGeoJSON {
  type: 'FeatureCollection'
  features: CountryFeature[]
}

// Overpass API types (roads)
export type OverpassElement =
  | {
      type: 'node'
      id: number
      lat: number
      lon: number
      tags?: Record<string, string>
    }
  | {
      type: 'way'
      id: number
      nodes: number[]
      geometry?: { lat: number; lon: number }[]
      tags?: Record<string, string>
    }

export interface OverpassResponse {
  version: number
  generator: string
  osm3s?: Record<string, unknown>
  elements: OverpassElement[]
}

// Crime and safety data types
export interface PoliceCrimeItem {
  id: string
  category: string
  location: {
    latitude: string
    longitude: string
    street: { id: number | null; name: string }
  }
  context?: string
  persistent_id?: string
  outcome_status?: { category: string; date: string } | null
}

export interface PoliceCategory {
  url: string
  name: string
}

export interface GlobalCrimeIndicator {
  indicator: string
  label: string
  unit: string
  latestYear: string | null
  latestValue: number | null
  series: Array<{ year: string; value: number }>
}

export interface CrimeDataBundle {
  incidents: PoliceCrimeItem[]
  indicators: GlobalCrimeIndicator[]
  source: 'uk-police' | 'world-bank' | 'mixed'
}

// OpenAQ types
export interface OpenAQLocation {
  id: number
  name: string
  coordinates?: { latitude: number; longitude: number }
  city?: string
  country?: string
  measurements?: OpenAQMeasurement[]
}

export interface OpenAQMeasurement {
  parameter: string
  value: number
  unit: string
  lastUpdated: string
  sourceName?: string
}

// REST Countries
export interface RestCountry {
  name: { common: string; official: string }
  cca2?: string
  cca3?: string
  cioc?: string
  capital?: string[]
  region?: string
  subregion?: string
  population?: number
  area?: number
  flags?: { png?: string; svg?: string }
  borders?: string[]
}

// World Bank responses (simple typed subset)
export type WorldBankSeries = Array<{
  country: { id: string; value: string }
  value: string | null
  date: string
}>

// Clustering result types
export interface Cluster {
  id: number
  centroid: LatLng
  points: LatLng[]
  count: number
  bounds: { south: number; west: number; north: number; east: number }
}

// App store types
export type TabKey = 'traffic' | 'crime' | 'aqi' | 'population'

export interface SelectedCountry {
  name: string
  code?: string
  bbox?: BBox
  centroid?: LatLng
}
