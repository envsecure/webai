import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../App.jsx';
import Brand from '../components/Brand.jsx';

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({ theme: 'light', editorTheme: 'dark', autoplay: true });
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState(null);
  const [label, setLabel] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.settings().then((res) => setSettings(res.settings)).catch(() => {});
    api.apiKeys().then((res) => setKeys(res.apiKeys)).catch(() => {});
  }, []);

  async function save(patch) {
    const res = await api.saveSettings({ ...settings, ...patch });
    setSettings(res.settings);
    setNotice('Saved');
    setTimeout(() => setNotice(''), 1800);
  }

  async function createKey() {
    const res = await api.createApiKey(label || 'Default key');
    setNewKey(res.key);
    setLabel('');
    setKeys((list) => [{ id: res.id, label: res.label, prefix: res.prefix, createdAt: new Date().toISOString() }, ...list]);
  }

  async function removeKey(id) {
    await api.deleteApiKey(id);
    setKeys((list) => list.filter((k) => k.id !== id));
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow" style={{ padding: '0 12px' }}>
            Workspace
          </span>
          <Link className="app-sidebar__link" to="/app">
            ▣ Projects
          </Link>
          <Link className="app-sidebar__link" to="/templates">
            ✧ Templates
          </Link>
          <Link className="app-sidebar__link" to="/community">
            ◍ Community
          </Link>
        </div>
        <div className="stack" style={{ gap: 4, marginTop: 8 }}>
          <span className="eyebrow" style={{ padding: '0 12px' }}>
            Account
          </span>
          <Link className="app-sidebar__link app-sidebar__link--active" to="/app/settings">
            ⚙ Settings
          </Link>
        </div>
        <div style={{ marginTop: 'auto' }} className="stack">
          <Link className="btn btn--quiet btn--sm" to="/">
            ← Back to site
          </Link>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <Brand size={22} to="/" />
          <span className="grow" />
          <span className="badge">{user?.email}</span>
          <Link className="btn btn--ghost btn--sm" to="/app">
            Back to site
          </Link>
        </header>

        <div className="page-head">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="muted" style={{ fontSize: 14 }}>
              Preferences, appearance and API access.
            </p>
          </div>
          {notice && <span className="badge badge--success">{notice}</span>}
        </div>

        <div className="grid grid--2">
          <section className="card">
            <h2 className="card__title">Appearance</h2>
            <p className="card__body">Choose how the app looks for you.</p>
            <div className="stack" style={{ marginTop: 18 }}>
              <div className="field">
                <label htmlFor="theme">Theme</label>
                <select
                  id="theme"
                  className="input"
                  value={settings.theme}
                  onChange={(e) => save({ theme: e.target.value })}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="editorTheme">Editor theme</label>
                <select
                  id="editorTheme"
                  className="input"
                  value={settings.editorTheme}
                  onChange={(e) => save({ editorTheme: e.target.value })}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <label className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={settings.autoplay}
                  onChange={(e) => save({ autoplay: e.target.checked })}
                />
                Autoplay generated previews
              </label>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">API keys</h2>
            <p className="card__body">
              Use a key to call the build API from a script. The key is shown only once.
            </p>
            <div className="row" style={{ marginTop: 16 }}>
              <input
                className="input"
                placeholder="Key label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <button className="btn btn--accent" onClick={createKey}>
                Create
              </button>
            </div>

            {newKey && (
              <div className="alert" style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {newKey}
                <br />
                <span className="subtle">Copy it now — it will not be shown again.</span>
              </div>
            )}

            <div className="stack" style={{ marginTop: 18 }}>
              {keys.length === 0 && <p className="muted" style={{ fontSize: 14 }}>No API keys yet.</p>}
              {keys.map((k) => (
                <div className="row" key={k.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span className="mono">{k.prefix}…</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {k.label}
                  </span>
                  <button
                    className="btn btn--quiet btn--sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => removeKey(k.id)}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
