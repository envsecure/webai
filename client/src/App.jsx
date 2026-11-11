import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import api, { clearSession, getStoredUser, getToken, setSession } from './lib/api.js';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import Landing from './pages/Landing.jsx';
import Pricing from './pages/Pricing.jsx';
import Templates from './pages/Templates.jsx';
import Community from './pages/Community.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Builder from './pages/Builder.jsx';
import Settings from './pages/Settings.jsx';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <App>');
  return ctx;
}

function Protected({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const [user, setUser] = useState(getStoredUser());
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('webai.theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('webai.theme', theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const res = await api.me();
        if (!cancelled) setUser(res.user);
      } catch {
        clearSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.login({ email, password });
    setSession(res.token, res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const signup = useCallback(async (payload) => {
    const res = await api.signup(payload);
    setSession(res.token, res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* session may already be gone */
    }
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, signup, logout, theme, setTheme }),
    [user, ready, login, signup, logout, theme]
  );

  const isAppRoute = location.pathname.startsWith('/app');

  return (
    <AuthContext.Provider value={value}>
      <div className="app-root">
        {!isAppRoute && <Nav />}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/community" element={<Community />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route
            path="/app"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/app/project/:projectId"
            element={
              <Protected>
                <Builder />
              </Protected>
            }
          />
          <Route
            path="/app/settings"
            element={
              <Protected>
                <Settings />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!isAppRoute && <Footer />}
      </div>
    </AuthContext.Provider>
  );
}
