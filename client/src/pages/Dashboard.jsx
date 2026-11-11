import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../App.jsx';
import PromptBox from '../components/PromptBox.jsx';
import Brand from '../components/Brand.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listProjects({ search })
      .then((res) => {
        if (!cancelled) setProjects(res.projects);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  async function remove(project) {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
    await api.deleteProject(project.id);
    setProjects((list) => list.filter((p) => p.id !== project.id));
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow" style={{ padding: '0 12px' }}>
            Workspace
          </span>
          <Link className="app-sidebar__link app-sidebar__link--active" to="/app">
            ▣ Projects
          </Link>
          <Link className="app-sidebar__link" to="/templates">
            ✧ Templates
          </Link>
          <Link className="app-sidebar__link" to="/community">
            ◍ Community
          </Link>
          <Link className="app-sidebar__link" to="/pricing">
            ◈ Plans
          </Link>
        </div>

        <div className="stack" style={{ gap: 4, marginTop: 8 }}>
          <span className="eyebrow" style={{ padding: '0 12px' }}>
            Account
          </span>
          <span className="app-sidebar__link">
            <span className="avatar" style={{ width: 22, height: 22 }} aria-hidden="true" />
            {user?.name || user?.email}
          </span>
          <Link className="app-sidebar__link" to="/app/settings">
            ⚙ Settings
          </Link>
        </div>

        <div style={{ marginTop: 'auto' }} className="stack">
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
              document.documentElement.dataset.theme = next;
              localStorage.setItem('webai.theme', next);
            }}
          >
            ◐ Toggle theme
          </button>
          <Link className="btn btn--quiet btn--sm" to="/">
            ← Back to site
          </Link>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <Brand size={22} to="/" />
          <span className="grow" />
          <span className="badge">{user?.plan || 'free'} plan</span>
          <Link className="btn btn--ghost btn--sm" to="/">
            Back to site
          </Link>
        </header>

        <div className="page-head">
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="muted" style={{ fontSize: 14 }}>
              {loading ? 'Loading…' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <input
            className="input"
            style={{ maxWidth: 240 }}
            placeholder="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <PromptBox compact />

        <div style={{ height: 24 }} />

        {loading ? (
          <div className="project-grid">
            {[0, 1, 2].map((i) => (
              <div className="skeleton" key={i} style={{ height: 180 }} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="empty">
            <p style={{ fontWeight: 600, color: 'var(--fg)' }}>No projects yet</p>
            <p style={{ marginTop: 6 }}>Describe an app above and it will be built for you.</p>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <div className="project-card" key={p.id}>
                <Link to={`/app/project/${p.id}`} className="project-card__name">
                  {p.name}
                </Link>
                <p className="project-card__desc">{p.description || p.prompt || 'No description yet.'}</p>
                <div className="row row--wrap" style={{ gap: 6 }}>
                  <span className="badge">{p.stack}</span>
                  <span className={`badge ${p.status === 'ready' ? 'badge--success' : ''}`}>
                    {p.status}
                  </span>
                </div>
                <div className="project-card__foot">
                  <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                  <span className="row" style={{ gap: 4 }}>
                    <button
                      className="btn btn--quiet btn--sm"
                      onClick={(e) => {
                        e.preventDefault();
                        remove(p);
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className="btn btn--quiet btn--sm"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/app/project/${p.id}`);
                      }}
                    >
                      Open →
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
