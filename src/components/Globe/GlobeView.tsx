import React, { useEffect, useRef, useState } from 'react'
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
    let Globe: any
    async function setup() {
      const module = await import('globe.gl')
      Globe = module.default
      if (!mounted || !containerRef.current) return
      const g = Globe()(containerRef.current.querySelector('.globe-canvas'))
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
      const canvasElement = containerRef.current.querySelector('.globe-canvas') as HTMLElement
      
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()
        zoomVelocity = event.deltaY * 0.0008
      }

      const smoothZoom = () => {
        if (Math.abs(zoomVelocity) > 0.0001) {
          const pov = g.pointOfView()
          const newAltitude = Math.max(1.5, Math.min(8, pov.altitude + zoomVelocity))
          g.pointOfView({ ...pov, altitude: newAltitude }, 300)
          zoomVelocity *= 0.92
        }
      }

      canvasElement?.addEventListener('wheel', handleWheel, { passive: false })
      const animationId = setInterval(smoothZoom, 16)

      return () => {
        canvasElement?.removeEventListener('wheel', handleWheel)
        clearInterval(animationId)
      }
    }
    setup()
    return () => {
      mounted = false
      if (globeRef.current && globeRef.current.dispose) globeRef.current.dispose()
      setGlobeReady(false)
    }
  }, [])

  useEffect(() => {
    if (!countries || !globeReady || !globeRef.current) return
    const g = globeRef.current

    const features: CountryFeature[] = countries.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        name: getCountryName(f)
      }
    }))
    const labels: CountryLabel[] = features.map((feature) => {
      const code = getCountryCode(feature)
      return {
        feature,
        name: getCountryName(feature),
        code,
        flag: flagFromCode(code),
        rank: Number(feature.properties.LABELRANK) || 6,
        ...getLabelPosition(feature)
      }
    })

    g.polygonsData(features)
      .polygonAltitude((feat: CountryFeature) => (hovered === getCountryName(feat) ? 0.035 : 0.012))
      .polygonCapColor((feat: CountryFeature) => (hovered === getCountryName(feat) ? 'rgba(80, 190, 255, 0.32)' : 'rgba(60, 150, 255, 0.045)'))
      .polygonSideColor(() => 'rgba(46, 139, 190, 0.22)')
      .polygonStrokeColor((feat: CountryFeature) => (hovered === getCountryName(feat) ? 'rgba(255, 255, 255, 0.95)' : 'rgba(184, 226, 255, 0.48)'))
      .onPolygonHover((feat: CountryFeature | null) => {
        setHovered(feat ? getCountryName(feat) : null)
      })
      .onPolygonClick((feat: CountryFeature) => {
        selectCountry(feat, setSelectedCountry)
      })

    g.htmlElementsData(labels)
      .htmlLat((label: CountryLabel) => label.lat)
      .htmlLng((label: CountryLabel) => label.lng)
      .htmlAltitude((label: CountryLabel) => (hovered === label.name ? 0.08 : 0.035))
      .htmlElement((label: CountryLabel) => buildCountryLabel(label, hovered === label.name, () => selectCountry(label.feature, setSelectedCountry)))
  }, [countries, hovered, globeReady, setSelectedCountry])

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
