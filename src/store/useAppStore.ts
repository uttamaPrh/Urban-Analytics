import create from 'zustand'
import { SelectedCountry, TabKey, BBox } from '@/types'

interface AppState {
  selectedCountry: SelectedCountry | null
  activeTab: TabKey
  mapBBox: BBox | null
  setSelectedCountry: (c: SelectedCountry | null) => void
  setActiveTab: (t: TabKey) => void
  setMapBBox: (b: BBox | null) => void
  clearSelectedCountry: () => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedCountry: null,
  activeTab: 'traffic',
  mapBBox: null,
  setSelectedCountry: (c: SelectedCountry | null) =>
    set(() => ({ selectedCountry: c })),
  setActiveTab: (t: TabKey) => set(() => ({ activeTab: t })),
  setMapBBox: (b: BBox | null) => set(() => ({ mapBBox: b })),
  clearSelectedCountry: () => set(() => ({ selectedCountry: null, mapBBox: null, activeTab: 'traffic' }))
}))

export default useAppStore
