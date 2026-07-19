import React, { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { Deck } from 'deck.gl/typed'
import useAppStore from '@/store/useAppStore'
import { BBox } from '@/types'
import { useTrafficData } from '@/hooks/useTrafficData'
import { useCrimeData } from '@/hooks/useCrimeData'
import { useAQIData } from '@/hooks/useAQIData'
import { useCountriesGeoJSON } from '@/hooks/useCountriesGeoJSON'
import { useTrafficClusters } from '@/hooks/useTrafficClusters'
import { buildLayers } from './LayerFactory'

interface BaseMapProps {
  bbox: BBox | null
  children?: React.ReactNode
}

export default function BaseMap({ bbox }: BaseMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const deckRef = useRef<Deck | null>(null)
  const setMapBBox = useAppStore((s) => s.setMapBBox)
  const activeTab = useAppStore((s) => s.activeTab)
  const country = useAppStore((s) => s.selectedCountry)
  
  // Fetch data for each tab
  const trafficData = useTrafficData(bbox)
  const crimeData = useCrimeData(bbox, 3, country?.code)
  const aqiData = useAQIData(bbox)
  const countriesGeoJSON = useCountriesGeoJSON()

  const trafficPoints = useMemo(() => trafficData.data ?? [], [trafficData.data])
  const trafficLayerPoints = useMemo(() => {
    if (!trafficData.data) return []

    const points = new Array(trafficData.data.length)
    for (let index = 0; index < trafficData.data.length; index += 1) {
      const datum = trafficData.data[index]
      points[index] = {
        position: [datum.lng, datum.lat] as [number, number],
        id: String(datum.lat + datum.lng),
      }
    }
    return points
  }, [trafficData.data])

  const trafficClusters = useTrafficClusters(trafficPoints, 0.5, 5)

  const crimeLayerPoints = useMemo(() => {
    if (!crimeData.data) return []

    const points = new Array(crimeData.data.incidents.length)
    for (let index = 0; index < crimeData.data.incidents.length; index += 1) {
      const incident = crimeData.data.incidents[index]
      points[index] = {
        position: [parseFloat(incident.location.longitude), parseFloat(incident.location.latitude)] as [number, number],
        id: incident.id,
      }
    }
    return points
  }, [crimeData.data])

  const aqiLayerPoints = useMemo(() => {
    if (!aqiData.data) return []

    const points = new Array(aqiData.data.length)
    for (let index = 0; index < aqiData.data.length; index += 1) {
      const station = aqiData.data[index]
      points[index] = {
        position: [station.coordinates?.longitude ?? 0, station.coordinates?.latitude ?? 0] as [number, number],
        value: station.measurements?.[0]?.value ?? 0,
        id: String(station.id),
      }
    }
    return points
  }, [aqiData.data])

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {},
        layers: []
      },
      center: [0, 20],
      zoom: 1
    })

    map.addControl(new maplibregl.NavigationControl({}), 'top-right')

    // Raster OSM tiles
    map.on('load', () => {
      map.addSource('osm-tiles', {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256
      })
      map.addLayer({ id: 'osm-tiles', type: 'raster', source: 'osm-tiles' })
      // attribution
      const attr = document.createElement('div')
      attr.className = 'osm-attribution'
      attr.style.position = 'absolute'
      attr.style.right = '8px'
      attr.style.bottom = '8px'
      attr.style.background = 'rgba(0,0,0,0.5)'
      attr.style.color = '#fff'
      attr.style.padding = '4px 8px'
      attr.style.borderRadius = '6px'
      attr.style.fontSize = '12px'
      attr.innerText = '© OpenStreetMap contributors'
      container.appendChild(attr)
    })

    mapRef.current = map

    // Deck overlay
    const deckCanvas = document.createElement('canvas')
    deckCanvas.style.position = 'absolute'
    deckCanvas.style.inset = '0'
    deckCanvas.style.width = '100%'
    deckCanvas.style.height = '100%'
    deckCanvas.style.pointerEvents = 'none'
    container.appendChild(deckCanvas)

    const deck = new Deck({
      canvas: deckCanvas,
      width: '100%',
      height: '100%',
      initialViewState: { longitude: 0, latitude: 20, zoom: 1 },
      controller: true,
      layers: []
    })
    deckRef.current = deck

    return () => {
      setMapBBox(null)
      map.remove()
      deck.finalize()
    }
  }, [setMapBBox])

  // fly to bbox when provided
  useEffect(() => {
    setMapBBox(bbox)
    if (!bbox || !mapRef.current) return
    const [s, w, n, e] = bbox
    const map = mapRef.current
    const bounds = [ [w, s], [e, n] ] as [[number, number], [number, number]]
    map.fitBounds(bounds, { padding: 40 })
  }, [bbox, setMapBBox])

  // Update deck layers based on active tab and data
  useEffect(() => {
    if (!deckRef.current) return

    let points: { position: [number, number]; value?: number; id?: string }[] = []
    let clusters: any[] = []

    // Prepare data based on active tab
    if (activeTab === 'traffic' && trafficData.data) {
      points = trafficLayerPoints
      clusters = trafficClusters.clusters
    } else if (activeTab === 'crime' && crimeData.data) {
      points = crimeLayerPoints
    } else if (activeTab === 'aqi' && aqiData.data) {
      points = aqiLayerPoints
    }

    // Build and set layers
    const layers = buildLayers({
      tab: activeTab,
      points,
      clusters,
      countryGeoJson: countriesGeoJSON.data
    })

    deckRef.current.setProps({ layers })
  }, [activeTab, aqiLayerPoints, crimeLayerPoints, countriesGeoJSON.data, trafficClusters.clusters, trafficData.data])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }} />
}
