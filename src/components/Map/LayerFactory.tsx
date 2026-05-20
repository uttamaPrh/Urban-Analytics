import { HexagonLayer, HeatmapLayer, ScatterplotLayer, PolygonLayer, TextLayer } from 'deck.gl/typed'
import { Cluster, CountriesGeoJSON, CountryFeature } from '@/types'
import { aqiColor, densityColor } from '@/lib/colorScales'

type PointDatum = { position: [number, number]; value?: number; id?: string }

interface LayerFactoryParams {
  tab: 'traffic' | 'crime' | 'aqi' | 'population'
  points?: PointDatum[]
  clusters?: Cluster[]
  countryGeoJson?: CountriesGeoJSON | null
}

export function buildLayers({ tab, points = [], clusters = [], countryGeoJson }: LayerFactoryParams) {
  switch (tab) {
    case 'traffic': {
      const hex = new HexagonLayer<PointDatum, {}>({
        id: 'hex-traffic',
        data: points,
        getPosition: (d: PointDatum) => d.position,
        radius: 400,
        elevationScale: 4,
        extruded: true,
        pickable: true,
        material: true
      })
      const texts = new TextLayer<Cluster, {}>({
        id: 'text-hotspots',
        data: clusters.slice(0, 3),
        getPosition: (d: Cluster) => [d.centroid.lng, d.centroid.lat],
        getText: (_d: Cluster, info) => `Hotspot #${info.index + 1}`,
        getSize: 24,
        getColor: [255, 255, 255]
      })
      return [hex, texts]
    }
    case 'crime': {
      const heat = new HeatmapLayer<PointDatum, {}>({
        id: 'heat-crime',
        data: points,
        getPosition: (d: PointDatum) => d.position,
        getWeight: (d: PointDatum) => d.value || 1,
        radiusPixels: 60
      })
      return [heat]
    }
    case 'aqi': {
      const scatter = new ScatterplotLayer<PointDatum, {}>({
        id: 'scatter-aqi',
        data: points,
        getPosition: (d: PointDatum) => d.position,
        getRadius: (d: PointDatum) => (d.value ? Math.max(2000 * (d.value / 200), 200) : 200),
        getFillColor: (d: PointDatum) => hexToRgbArray(aqiColor(d.value || 0)),
        pickable: true
      })
      return [scatter]
    }
    case 'population': {
      const polygon = new PolygonLayer<CountryFeature, {}>({
        id: 'poly-country',
        data: countryGeoJson?.features ?? [],
        getPolygon: (d: CountryFeature) => {
          // Handle both Polygon and MultiPolygon
          if (d.geometry.type === 'Polygon') {
            return d.geometry.coordinates
          } else if (d.geometry.type === 'MultiPolygon') {
            // For MultiPolygon, return the first polygon
            return d.geometry.coordinates[0] || []
          }
          return []
        },
        getFillColor: () => [40, 120, 200, 120]
      })
      return [polygon]
    }
    default:
      return []
  }
}

function hexToRgbArray(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return [r, g, b]
}

export default buildLayers
