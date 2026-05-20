import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { Deck } from 'deck.gl/typed'
import useAppStore from '@/store/useAppStore'
import { BBox } from '@/types'
import { useTrafficData } from '@/hooks/useTrafficData'
import { useCrimeData } from '@/hooks/useCrimeData'
import { useAQIData } from '@/hooks/useAQIData'
import { useCountriesGeoJSON } from '@/hooks/useCountriesGeoJSON'
import { dbscan } from '@/lib/clustering'
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
  
  // Fetch data for each tab
  const trafficData = useTrafficData(bbox)
  const crimeData = useCrimeData(bbox, 3)
  const aqiData = useAQIData(bbox)
  const countriesGeoJSON = useCountriesGeoJSON()

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
      points = trafficData.data.map((d: any) => ({
        position: [d.lng, d.lat] as [number, number],
        id: String(d.lat + d.lng)
      }))
      clusters = dbscan(trafficData.data.map(d => ({ lat: d.lat, lng: d.lng })), 0.5, 5)
    } else if (activeTab === 'crime' && crimeData.data) {
      points = crimeData.data.map((d: any) => ({
        position: [parseFloat(d.location.longitude), parseFloat(d.location.latitude)] as [number, number],
        id: d.id
      }))
    } else if (activeTab === 'aqi' && aqiData.data) {
      points = aqiData.data.map((d: any) => ({
        position: [d.coordinates?.longitude ?? 0, d.coordinates?.latitude ?? 0] as [number, number],
        value: d.measurements?.[0]?.value ?? 0,
        id: String(d.id)
      }))
    }

    // Build and set layers
    const layers = buildLayers({
      tab: activeTab,
      points,
      clusters,
      countryGeoJson: countriesGeoJSON.data
    })

    deckRef.current.setProps({ layers })
  }, [activeTab, trafficData.data, crimeData.data, aqiData.data, countriesGeoJSON.data])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 0 }} />
}
