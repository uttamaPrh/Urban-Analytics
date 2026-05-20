import React, { useEffect, useRef, useState } from 'react'
import useAppStore from '@/store/useAppStore'
import '@/components/Globe/GlobeView.css'
import { CountriesGeoJSON, CountryFeature, LatLng } from '@/types'
import { bboxFromCoordinates, centroidOfCoords } from '@/lib/geoUtils'

const GEOJSON_PATH = '/countries.geojson'

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
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .showAtmosphere(true)
        .atmosphereColor('#99ccff')
        .atmosphereAltitude(0.2)
      globeRef.current = g
      setGlobeReady(true)
      // auto rotate
      g.controls().autoRotate = true
      g.controls().autoRotateSpeed = 0.2

      // keyboard accessibility: focusable country selection handled by click handlers below
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

    const features = countries.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        name: (f.properties.NAME_LONG || f.properties.NAME).toString()
      }
    }))

    g.polygonsData(features)
      .polygonAltitude(0.01)
      .polygonCapColor((feat: CountryFeature) => (hovered === feat.properties.NAME ? 'rgba(255,255,255,0.12)' : 'rgba(100,120,140,0.02)'))
      .onPolygonHover((feat: CountryFeature | null) => {
        setHovered(feat ? feat.properties.NAME : null)
      })
      .onPolygonClick((feat: CountryFeature) => {
        // compute bbox and centroid from geometry coordinates
        if (!feat || !feat.geometry) return
        const coords: number[][] =
          feat.geometry.type === 'Polygon'
            ? feat.geometry.coordinates[0]
            : // take first ring of multi
              feat.geometry.type === 'MultiPolygon'
            ? feat.geometry.coordinates[0][0]
            : []
        if (!coords.length) return
        const bbox = bboxFromCoordinates(coords)
        const centroid = centroidOfCoords(coords)
        setSelectedCountry({ name: feat.properties.NAME_LONG || feat.properties.NAME, code: feat.properties.ISO_A3, bbox: bbox as any, centroid: centroid as LatLng })
      })
  }, [countries, hovered, globeReady, setSelectedCountry])

  return (
    <div className="globe-container" ref={containerRef}>
      <div className="star-field" aria-hidden="true" />
      <div className="globe-canvas" />
      <div className="floating-card" role="region" aria-label="landing-card">
        <h2 className="text-lg font-semibold">Select a country to explore urban analytics</h2>
      </div>
    </div>
  )
}
