import React, { useEffect, useMemo, useRef, useState } from 'react'
import useAppStore from '@/store/useAppStore'
import '@/components/Globe/GlobeView.css'
import { CountriesGeoJSON, CountryFeature, LatLng } from '@/types'
import { bboxFromCoordinates, centroidOfCoords } from '@/lib/geoUtils'

const GEOJSON_PATH = '/countries.geojson'
const EARTH_IMAGE = '/textures/earth-blue-marble.jpg'
const EARTH_BUMP = '/textures/earth-topology.png'

type CountryLabel = {
  feature: CountryFeature
  name: string
  code: string
  flag: string
  lat: number
  lng: number
  rank: number
}

function getCountryName(feature: CountryFeature): string {
  return (feature.properties.NAME_LONG || feature.properties.NAME).toString()
}

function getCountryCode(feature: CountryFeature): string {
  const code = feature.properties.ISO_A2
  return typeof code === 'string' && code.length === 2 && code !== '-99' ? code.toUpperCase() : ''
}

function flagFromCode(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '🌐'
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)))
}

function getLabelPosition(feature: CountryFeature): Pick<CountryLabel, 'lat' | 'lng'> {
  const labelLng = feature.properties.LABEL_X
  const labelLat = feature.properties.LABEL_Y
  if (typeof labelLat === 'number' && typeof labelLng === 'number') {
    return { lat: labelLat, lng: labelLng }
  }

  const coords: number[][] =
    feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates[0]
      : feature.geometry.type === 'MultiPolygon'
      ? feature.geometry.coordinates[0][0]
      : []
  const centroid = centroidOfCoords(coords)
  return { lat: centroid.lat, lng: centroid.lng }
}

function selectCountry(feature: CountryFeature, setSelectedCountry: ReturnType<typeof useAppStore.getState>['setSelectedCountry']) {
  if (!feature || !feature.geometry) return
  const coords: number[][] =
    feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates[0]
      : feature.geometry.type === 'MultiPolygon'
      ? feature.geometry.coordinates[0][0]
      : []
  if (!coords.length) return
  const bbox = bboxFromCoordinates(coords)
  const centroid = centroidOfCoords(coords)
  setSelectedCountry({ name: getCountryName(feature), code: feature.properties.ISO_A3, bbox: bbox as any, centroid: centroid as LatLng })
}

function buildCountryLabel(label: CountryLabel, active: boolean, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `country-label rank-${Math.min(label.rank, 7)}${active ? ' is-active' : ''}`
  el.title = label.name
  el.setAttribute('aria-label', `${label.name}, ${label.code || 'country'}`)
  const flag = document.createElement('span')
  flag.className = 'country-label-flag'
  flag.textContent = label.flag
  const name = document.createElement('span')
  name.className = 'country-label-name'
  name.textContent = label.name
  el.append(flag, name)
  el.onclick = (event) => {
    event.stopPropagation()
    onClick()
  }
  return el
}

export default function GlobeView(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeRef = useRef<any>(null)
  const setSelectedCountry = useAppStore((s) => s.setSelectedCountry)
  const [countries, setCountries] = useState<CountriesGeoJSON | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [globeReady, setGlobeReady] = useState(false)

  const visualizationData = useMemo(() => {
    if (!countries) return null

    const features: CountryFeature[] = new Array(countries.features.length)
    const labels: CountryLabel[] = new Array(countries.features.length)

    for (let index = 0; index < countries.features.length; index += 1) {
      const sourceFeature = countries.features[index]
      const name = getCountryName(sourceFeature)
      const code = getCountryCode(sourceFeature)
      const enrichedFeature: CountryFeature = {
        ...sourceFeature,
        properties: {
          ...sourceFeature.properties,
          name,
        },
      }

      features[index] = enrichedFeature
      labels[index] = {
        feature: enrichedFeature,
        name,
        code,
        flag: flagFromCode(code),
        rank: Number(sourceFeature.properties.LABELRANK) || 6,
        ...getLabelPosition(sourceFeature),
      }
    }

    return { features, labels }
  }, [countries])

  useEffect(() => {
    let mounted = true
    fetch(GEOJSON_PATH)
      .then((r) => r.json())
      .then((j: CountriesGeoJSON) => {
        if (mounted) setCountries(j)
      })
      .catch(() => setCountries(null))
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | null = null
    async function setup() {
      const module = await import('globe.gl')
      if (!mounted || !containerRef.current) return
      const canvasElement = containerRef.current.querySelector('.globe-canvas') as HTMLElement | null
      if (!canvasElement) return

      const Globe = module.default
      const g = new Globe(canvasElement)
        .globeImageUrl(EARTH_IMAGE)
        .bumpImageUrl(EARTH_BUMP)
        .backgroundColor('rgba(0,0,0,0)')
        .showAtmosphere(true)
        .atmosphereColor('#7ec8ff')
        .atmosphereAltitude(0.16)
      globeRef.current = g
      setGlobeReady(true)

      g.controls().autoRotate = true
      g.controls().autoRotateSpeed = 0.18
      g.controls().enableDamping = true
      g.controls().dampingFactor = 0.08

      g.pointOfView({ lat: 18, lng: 12, altitude: 2.45 }, 0)

      let zoomVelocity = 0
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()
        zoomVelocity = event.deltaY * 0.0008
      }

      let animationFrameId = 0
      const smoothZoom = () => {
        if (!mounted) return
        if (Math.abs(zoomVelocity) > 0.0001) {
          const pov = g.pointOfView()
          const newAltitude = Math.max(1.5, Math.min(8, pov.altitude + zoomVelocity))
          g.pointOfView({ ...pov, altitude: newAltitude }, 300)
          zoomVelocity *= 0.92
        }

        animationFrameId = window.requestAnimationFrame(smoothZoom)
      }

      canvasElement?.addEventListener('wheel', handleWheel, { passive: false })
      animationFrameId = window.requestAnimationFrame(smoothZoom)

      cleanup = () => {
        canvasElement?.removeEventListener('wheel', handleWheel)
        window.cancelAnimationFrame(animationFrameId)
      }
    }
    void setup()
    return () => {
      mounted = false
      cleanup?.()
      if (globeRef.current && globeRef.current.dispose) globeRef.current.dispose()
      globeRef.current = null
      setGlobeReady(false)
    }
  }, [])

  useEffect(() => {
    if (!visualizationData || !globeReady || !globeRef.current) return
    const g = globeRef.current
    const { features, labels } = visualizationData

    g.polygonsData(features)
      .polygonAltitude((feat: CountryFeature) => (hovered === feat.properties.name ? 0.035 : 0.012))
      .polygonCapColor((feat: CountryFeature) => (hovered === feat.properties.name ? 'rgba(80, 190, 255, 0.32)' : 'rgba(60, 150, 255, 0.045)'))
      .polygonSideColor(() => 'rgba(46, 139, 190, 0.22)')
      .polygonStrokeColor((feat: CountryFeature) => (hovered === feat.properties.name ? 'rgba(255, 255, 255, 0.95)' : 'rgba(184, 226, 255, 0.48)'))
      .onPolygonHover((feat: unknown) => {
        const hoveredFeature = feat as CountryFeature | null
        setHovered(hoveredFeature ? getCountryName(hoveredFeature) : null)
      })
      .onPolygonClick((feat: CountryFeature) => {
        selectCountry(feat, setSelectedCountry)
      })

    g.htmlElementsData(labels)
      .htmlLat((label: CountryLabel) => label.lat)
      .htmlLng((label: CountryLabel) => label.lng)
      .htmlAltitude((label: CountryLabel) => (hovered === label.name ? 0.08 : 0.035))
      .htmlElement((label: CountryLabel) => buildCountryLabel(label, hovered === label.name, () => selectCountry(label.feature, setSelectedCountry)))
  }, [hovered, globeReady, setSelectedCountry, visualizationData])

  return (
    <div className="globe-container" ref={containerRef}>
      <div className="star-field" aria-hidden="true" />
      <div className="globe-canvas" />
      <div className="globe-toolbar" role="region" aria-label="Globe controls">
        <p>Drag to rotate. Scroll to zoom. Select any country label or border.</p>
      </div>
    </div>
  )
}
