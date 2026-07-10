import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AssistantWidget from './AssistantWidget';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <header className="topbar">
        <span className="brand">Weekly Reports</span>
        <nav>
          {user && <NavLink to="/my-reports">My reports</NavLink>}
          {user?.role === 'MANAGER' && <NavLink to="/dashboard">Team dashboard</NavLink>}
          {user && <NavLink to="/projects">Projects</NavLink>}
        </nav>
        {user && (
          <>
            <span className="who">
              {user.name} · {user.role === 'MANAGER' ? 'Manager' : 'Team member'}
            </span>
            <button className="subtle" onClick={handleLogout}>
              Log out
            </button>
          </>
        )}
      </header>
      <main className="page">
        <Outlet />
      </main>
      {user?.role === 'MANAGER' && <AssistantWidget />}
    </>
  );
}
