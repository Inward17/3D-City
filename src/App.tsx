import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './features/dashboard/Dashboard';
import { ProjectCreation } from './components/ProjectCreation';
import { EditProject } from './components/EditProject';
import { CityViewer } from './components/CityViewer';
import { useDarkMode } from './hooks/useDarkMode';

/**
 * Routes.
 *
 * There is no sign-in: every project lives in the browser's own storage (see
 * lib/localRepo). The app previously wrapped these routes in an auth guard
 * backed by Supabase, which needed VITE_SUPABASE_* environment variables — the
 * deployed build threw on the missing values before React ever rendered.
 * The guard and the /auth screen went with it.
 */
function App() {
  // Initialize dark mode
  useDarkMode();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<ProjectCreation />} />
        <Route path="/edit/:id" element={<EditProject />} />
        <Route path="/project/:id" element={<CityViewer />} />
        {/* Anything unknown, including the old /auth path, goes home. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
