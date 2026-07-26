import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Dashboard } from './features/dashboard/Dashboard';
import { ProjectCreation } from './components/ProjectCreation';
import { EditProject } from './components/EditProject';
import { CityViewer } from './components/CityViewer';
import { useAuthStore } from './store/authStore';
import { useDarkMode } from './hooks/useDarkMode';
import { DEMO_MODE } from './lib/demoMode';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session } = useAuthStore();
  // Demo mode runs against localRepo, which needs no signed-in user.
  if (DEMO_MODE) return <>{children}</>;
  return session ? <>{children}</> : <Navigate to="/auth" />;
}

function App() {
  // Initialize dark mode
  useDarkMode();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={DEMO_MODE ? <Navigate to="/" replace /> : <Auth />}
        />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/create"
          element={
            <PrivateRoute>
              <ProjectCreation />
            </PrivateRoute>
          }
        />
        <Route
          path="/edit/:id"
          element={
            <PrivateRoute>
              <EditProject />
            </PrivateRoute>
          }
        />
        <Route
          path="/project/:id"
          element={
            <PrivateRoute>
              <CityViewer />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;