# 3D City Planner

A real-time, interactive **3D city planning platform** built with React, Three.js, and Supabase. Design city sectors, visualize buildings with Level-of-Detail rendering, analyze metrics, and collaborate — all in the browser.

![3D City Planner](https://img.shields.io/badge/React-18-blue?logo=react) ![Three.js](https://img.shields.io/badge/Three.js-r160-black?logo=three.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript) ![Supabase](https://img.shields.io/badge/Supabase-2-green?logo=supabase) ![Vite](https://img.shields.io/badge/Vite-5-purple?logo=vite)

---

## ✨ Features

- **Interactive 3D Viewer** — Navigate, pan, orbit and zoom a procedurally generated city using Three.js / React Three Fiber
- **Sector System** — Create and manage residential, commercial, industrial, parks, and mixed-use sectors
- **Building Designer** — Design custom buildings with configurable floors, facades, and roof styles
- **Procedural Generation** — Buildings, roads, vegetation, vehicles, and street assets generated from seed data
- **LOD Rendering** — Level-of-Detail system for smooth performance at all zoom levels
- **Instanced Rendering** — Instanced meshes for buildings, trees, vehicles, and street lamps
- **Real-time Analytics** — Sector-level metrics including population, energy, carbon, and land use
- **Mini Map** — 2D overview map with sector overlays and real MapLibre GL base tiles
- **Weather System** — Dynamic weather effects (rain, snow, fog, sun)
- **Location Comments** — Pin comments and annotations to map locations
- **Route Preview** — Visualise road routes overlaid on the 3D scene
- **Demo Mode** — Runs fully offline with `localStorage`-backed data (no login needed)
- **Auth + Projects** — Supabase-backed authentication with per-user project storage
- **Dark Mode** — System-aware dark/light theme toggle

---

## 🗂 Project Structure

```
3D-City/
├── src/
│   ├── components/          # UI and 3D scene components
│   │   ├── optimized/       # Instanced & LOD rendering components
│   │   └── layers/          # Roads, buildings, environment layers
│   ├── features/
│   │   └── dashboard/       # Dashboard page & sub-components
│   ├── hooks/               # Custom React hooks (dark mode, etc.)
│   ├── lib/                 # Supabase client, local repo, demo mode
│   ├── store/               # Zustand global state stores
│   ├── types/               # TypeScript interfaces and types
│   ├── utils/               # City metrics, geometry, routing helpers
│   └── data/                # City sector & planning seed data
├── backend/                 # FastAPI Python backend (optional)
│   ├── app/                 # API routes, models, database
│   ├── requirements.txt
│   └── run.py
├── supabase/
│   └── migrations/          # Supabase SQL migration files
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- (Optional) **Python** ≥ 3.10 for the backend API
- (Optional) **Supabase** project for auth & cloud storage

### 1. Clone & Install

```bash
git clone https://github.com/Inward17/3D-City.git
cd 3D-City
npm install
```

### 2. Environment Variables

Copy the example and fill in your Supabase credentials:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

> **Demo Mode** — If you just want to try the app without a Supabase project, leave the env file empty. `DEMO_MODE` is enabled by default in `src/lib/demoMode.ts` and uses localStorage for all data.

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production

```bash
npm run build
npm run preview
```

---

## 🐍 Backend (Optional)

The Python FastAPI backend provides an alternative to Supabase for auth and project storage.

```bash
cd backend
pip install -r requirements.txt
python run.py
```

API docs available at [http://localhost:8000/docs](http://localhost:8000/docs)

See [`backend/README.md`](backend/README.md) for full setup instructions.

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
| Backend / Auth | Supabase |
| Build Tool | Vite |
| Testing | Vitest |
| Python API | FastAPI + SQLAlchemy |

---

## ⚙️ Configuration

### Demo Mode

Edit `src/lib/demoMode.ts` to toggle:

```ts
// true  → no login, data stored in localStorage
// false → full Supabase auth + DB
export const DEMO_MODE = true;
```

### Supabase Migrations

SQL migration files are in `supabase/migrations/`. Apply them via the Supabase CLI:

```bash
supabase db push
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push and open a PR: `git push origin feat/my-feature`

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
