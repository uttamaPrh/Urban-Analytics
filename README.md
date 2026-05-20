# 🌍 Urban Analytics Platform

A geospatial urban analytics platform for exploring country-level demographics, crime statistics, and urban indicators through an interactive 3D globe interface.

**Tech Stack:** Vite + React + TypeScript + TailwindCSS + Zustand + React Query

---

## 🚀 Features

- **Interactive 3D Globe** - Navigate and select countries from a rotating 3D globe
- **Population Analytics** - View country population, area, density, capital, and regional data
- **Crime Statistics** - Explore crime incidents and categories (UK data via Police API)
- **Beautiful Dashboard** - Dark-themed dashboard with card-based analytics layout
- **Real-time Data Fetching** - Uses multiple free public APIs for current data
- **Type-Safe** - Full TypeScript support for robust development

---

## 📋 Prerequisites

- **Node.js** ≥ 18
- **npm** (comes with Node.js)
- Internet connection (for API calls)

---

## 🔧 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/urban-analytics.git
   cd urban-analytics
   ```
2. **Install dependencies:**

   ```bash
   npm install
   ```
3. **Download geographic data:**

   ```bash
   npx ts-node scripts/download-geodata.ts
   ```

   This downloads the countries GeoJSON file (~5MB)

---

## 📌 Running the App

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser

### Production Build

```bash
npm run build
npm run preview
```

### Type Checking

```bash
npm run typecheck
```

---

## 🎮 How to Use

1. **Start** - Open the app and see the 3D interactive globe
2. **Select** - Click on any country to view analytics
3. **Explore** - Switch between Population and Crime tabs
4. **Return** - Click "← Globe" to select a different country

### Tabs Available

- **👥 Population** - Demographics from REST Countries & World Bank APIs
- **🚨 Crime & Safety** - Crime incidents (UK only, last 3 months)

---

## 🌐 API Endpoints

| API                                             | Purpose                      | Free   | Auth Required |
| ----------------------------------------------- | ---------------------------- | ------ | ------------- |
| [REST Countries](https://restcountries.com/v3.1)   | Country data                 | ✅ Yes | ❌ No         |
| [World Bank](https://api.worldbank.org/v2)         | Population & area indicators | ✅ Yes | ❌ No         |
| [UK Police API](https://data.police.uk/api)        | Crime incidents              | ✅ Yes | ❌ No         |
| [OpenStreetMap Overpass](https://overpass-api.de)  | Road networks                | ✅ Yes | ❌ No         |
| [Natural Earth](https://www.naturalearthdata.com/) | Country boundaries           | ✅ Yes | ❌ No         |

**Note:** All APIs are free and don't require authentication.

---

## 📦 Project Structure

```
urban-analytics/
├── src/
│   ├── components/
│   │   ├── Globe/          # 3D globe with country selection
│   │   ├── UI/             # Navbar and utility components
│   │   └── Sidebar/        # Analytics dashboard & tabs
│   ├── hooks/              # React Query data fetching hooks
│   ├── lib/                # Utilities (geo, clustering, colors)
│   ├── store/              # Zustand state management
│   ├── types/              # TypeScript definitions
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── public/
│   └── countries.geojson   # Country boundaries (auto-downloaded)
├── scripts/
│   └── download-geodata.ts # Download script for GeoJSON
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🛠️ Development

### Add a New Analytics Tab

1. Create a new hook in `src/hooks/` (e.g., `useNewData.ts`)
2. Add tab component in `src/components/Sidebar/`
3. Update `Analytics.tsx` to include the new tab
4. Add tab type to `TabType` union

### Environment Variables

No environment variables needed! The app uses public APIs without authentication.

---

## 🐛 Known Limitations

- **Crime Data** - Only available for UK (England, Wales, Northern Ireland)
- **Air Quality** - OpenAQ API has CORS restrictions (not included in UI)
- **Geographic Coverage** - Road data available via Overpass API but not visualized (removed map UI)

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🙋 Support & Contributing

### Reporting Issues

If you encounter any bugs or issues, please create an issue on GitHub.

### Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

---

## 🚀 Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

---

## 📚 Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [TailwindCSS Docs](https://tailwindcss.com/)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [React Query Docs](https://tanstack.com/query/latest)
