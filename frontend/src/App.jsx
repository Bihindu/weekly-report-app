import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import MyReports from './pages/MyReports';
import TeamDashboard from './pages/TeamDashboard';
import Projects from './pages/Projects';

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const home = user?.role === 'MANAGER' ? '/dashboard' : '/my-reports';

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route
          path="/my-reports"
          element={
            <Protected>
              <MyReports />
            </Protected>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Protected role="MANAGER">
              <TeamDashboard />
            </Protected>
          }
        />
        <Route
          path="/projects"
          element={
            <Protected>
              <Projects />
            </Protected>
          }
        />
      </Route>
    </Routes>
  );
}
