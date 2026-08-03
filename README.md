# 3D City Planner

A real-time, interactive **3D city planning platform** built with React, Three.js, and a fully offline-capable local data store. Design city sectors, visualise buildings with Level-of-Detail rendering, run transport models, study solar shadows, and analyse metrics — all in the browser.

![React](https://img.shields.io/badge/React-18-blue?logo=react) ![Three.js](https://img.shields.io/badge/Three.js-r160-black?logo=three.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript) ![Vite](https://img.shields.io/badge/Vite-5-purple?logo=vite) ![Vitest](https://img.shields.io/badge/Tested-Vitest-green?logo=vitest)

---

## ✨ Features

### 3D City View
- **Interactive 3D Viewer** — Navigate, pan, orbit and zoom a procedurally generated city using Three.js / React Three Fiber
- **Sector System** — Create and manage residential, commercial, industrial, parks, and mixed-use sectors
- **Building Designer** — Design custom buildings with configurable floors, width/depth, facades, and roof styles
- **Procedural Generation** — Buildings, roads, vegetation, vehicles, and street assets generated from seed data
- **LOD Rendering** — Level-of-Detail system for smooth performance at all zoom levels
- **Instanced Rendering** — Instanced meshes for buildings, trees, vehicles, and street lamps

### Terrain & Roads
- **Procedural Terrain** — Deterministic heightmap using Simplex noise; roads follow gradients and buildings sit on graded platforms
- **Road Network** — Unified routed road network so road ribbons and vehicle paths share the same geometry (no more cars driving beside their roads)
- **Road Crossings** — At-grade, bridge/overpass, and **roundabout** junction styles, all affecting travel time
- **Building Collision** — Footprint overlap detection with configurable minimum gap; roads bend around buildings automatically
- **Max Buildable Size** — Binary-search solver finds the largest building that fits given its neighbours and road corridors

### Transport Modelling
- **Trip Model** — Gravity model origin-destination trips derived from occupancy curves; moving a building changes which roads carry its traffic
- **Traffic Assignment** — Frank-Wolfe user-equilibrium assignment: roads have capacity, travel time rises as they fill, and drivers re-route until no one can switch to a faster path
- **Dijkstra Routing** — Shortest-path routing by driving time (not distance), so arterials beat residential shortcuts the way real drivers choose
- **Intersection Info Panel** — Click any crossing to inspect flow, junction type, and delay

### Solar & Shadow Analysis
- **Accurate Solar Position** — Ephemeris-quality sun position from latitude, date, and local solar time (replaces the old fixed east-west arc)
- **Shadow Study** — Midwinter / equinox / midsummer presets; shadow-ratio calculation gives planners the number they argue over
- **Day Length** — Polar-day and polar-night edge cases handled correctly

### Analytics & UI
- **Real-time Metrics** — Sector-level population, energy, carbon, land use, and road V/C ratios
- **Mini Map** — 2D overview map with sector overlays
- **Weather System** — Dynamic weather (rain, snow, fog, sun) affecting vehicle free-flow speeds in the assignment model
- **Location Comments** — Pin comments and annotations to map locations
- **Route Preview** — Visualise road routes overlaid on the 3D scene
- **Dark Mode** — System-aware dark/light theme toggle
- **Offline / Demo Mode** — `localStorage`-backed data store; works with no backend and no login

---

## 🗂 Project Structure

```
3D-City/
├── src/
│   ├── components/               # UI and 3D scene components
│   │   ├── IntersectionInfo.tsx  # Junction detail panel
│   │   ├── IntersectionPanel.tsx # Crossing style picker
│   │   ├── optimized/            # Instanced & LOD rendering
│   │   └── layers/               # Roads, buildings, environment, junctions
│   ├── features/
│   │   └── dashboard/            # Dashboard page & sub-components
│   ├── hooks/
│   │   ├── useRoadNetwork.ts     # Memoised road network builder
│   │   └── useAssignment.ts      # Frank-Wolfe assignment hook
│   ├── lib/
│   │   └── localRepo.ts          # localStorage-backed project store
│   ├── store/                    # Zustand global state stores
│   ├── types/                    # TypeScript interfaces and types
│   ├── utils/
│   │   ├── assignment.ts         # Frank-Wolfe traffic assignment
│   │   ├── buildingCollision.ts  # Footprint overlap & max-size solver
│   │   ├── buildingDimensions.ts # Design limits & effective dimensions
│   │   ├── cityMetrics.ts        # Population, energy, carbon metrics
│   │   ├── roadCrossings.ts      # Junction detection & styles
│   │   ├── roadGeometry.ts       # Ribbon mesh builder
│   │   ├── roadNetwork.ts        # Unified routed network & keep-outs
│   │   ├── roadRouting.ts        # Obstacle-avoidance path planner
│   │   ├── scale.ts              # World-space constants
│   │   ├── selectVisibleCity.ts  # Frustum-culling helpers
│   │   ├── solar.ts              # Sun position, shadow ratio, day length
│   │   ├── terrain.ts            # Simplex heightmap & grade utilities
│   │   ├── trafficDemand.ts      # Hourly demand curves
│   │   ├── tripModel.ts          # O-D gravity model & vehicle paths
│   │   ├── vehicleGeometries.ts  # Instanced vehicle meshes
│   │   └── vehicleHeading.ts     # Heading interpolation
│   └── data/                     # City sector & planning seed data
├── public/
│   └── _redirects                # Cloudflare Pages SPA routing
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── vercel.json                   # Vercel SPA config
├── netlify.toml                  # Netlify SPA config
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### 1. Clone & Install

```bash
git clone https://github.com/Inward17/3D-City.git
cd 3D-City
npm install
```

### 2. Environment Variables (optional)

The app runs fully offline in demo mode with no configuration needed. If you want Supabase cloud sync, copy the example:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 4. Build for Production

```bash
npm run build
npm run preview
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Tests use **Vitest** + jsdom. Test files live alongside source files (`*.test.ts`).

Key test suites:
| File | What it covers |
|------|---------------|
| `assignment.test.ts` | Frank-Wolfe convergence, V/C ratios, junction delay |
| `tripModel.test.ts` | O-D gravity model, Dijkstra routing, vehicle advance |
| `roadNetwork.test.ts` | Network build, bridge elevation, keep-out circles |
| `roadRouting.test.ts` | Obstacle-avoidance path planner |
| `buildingCollision.test.ts` | Overlap detection, max-size binary search |
| `solar.test.ts` | Sun position, shadow ratio, polar edge cases |
| `terrain.test.ts` | Heightmap determinism, grade calculation |
| `cityMetrics.test.ts` | Population, energy, carbon |
| `scale.test.ts` | World-space constants |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript |
| 3D Rendering | Three.js via React Three Fiber |
| Post Processing | @react-three/postprocessing |
| State Management | Zustand |
| Routing | React Router v6 |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Charts | Recharts |
| Map Tiles | MapLibre GL + react-map-gl |
| Noise | simplex-noise (terrain) |
| Build Tool | Vite |
| Testing | Vitest + jsdom |

---

## ☁️ Deployment

The repo is pre-configured for one-click deployment on:

| Platform | Config file | Notes |
|----------|-------------|-------|
| **Cloudflare Pages** | `public/_redirects` | Build: `npm run build`, Output: `dist` |
| **Vercel** | `vercel.json` | Auto-detected as Vite |
| **Netlify** | `netlify.toml` | Auto-detected |

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables on your platform if using Supabase.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push and open a PR: `git push origin feat/my-feature`

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
