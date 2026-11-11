import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../App.jsx';
import Brand from '../components/Brand.jsx';

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    theme: 'light',
    editorTheme: 'dark',
    autoplay: true,
    llm: {
      provider: 'mock',
      model: '',
      baseUrl: '',
      hasApiKey: false,
      maxIterations: 12,
      reviewRounds: 1,
      subagents: true,
      contextTokens: 24000,
    },
  });
  const [llm, setLlm] = useState(null);
  const [providers, setProviders] = useState([]);
  const [subagents, setSubagents] = useState([]);
  const [environment, setEnvironment] = useState({});
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState(null);
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [notice, setNotice] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((res) => {
        setSettings(res.settings);
        setLlm(res.llm);
        setProviders(res.providers || []);
        setSubagents(res.subagents || []);
        setEnvironment(res.environment || {});
      })
      .catch(() => {});
    api.apiKeys().then((res) => setKeys(res.apiKeys)).catch(() => {});
  }, []);

  function flash(text) {
    setNotice(text);
    setTimeout(() => setNotice(''), 1800);
  }

  async function save(patch) {
    const body = { ...settings, ...patch };
    if (patch.llm) body.llm = { ...settings.llm, ...patch.llm };
    const res = await api.saveSettings(body);
    setSettings(res.settings);
    setLlm(res.llm);
    flash('Saved');
  }

  async function saveLlm(patch) {
    const body = { ...settings.llm, ...patch };
    if (apiKey) body.apiKey = apiKey;
    const res = await api.saveSettings({ llm: body });
    setSettings(res.settings);
    setLlm(res.llm);
    setApiKey('');
    flash('Saved');
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testLlm();
      setTestResult({ ok: true, message: res.reply || res.message });
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function createKey() {
    const res = await api.createApiKey(label || 'Default key');
    setNewKey(res.key);
    setLabel('');
    setKeys((list) => [
      { id: res.id, label: res.label, prefix: res.prefix, createdAt: new Date().toISOString() },
      ...list,
    ]);
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
              The AI model that builds your apps, appearance and API access.
            </p>
          </div>
          {notice && <span className="badge badge--success">{notice}</span>}
        </div>

        <div className="grid grid--2">
          {/* ------------------------------------------------- AI model */}
          <section className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 className="card__title">AI model</h2>
              {llm && (
                <span className={`badge ${llm.isMock ? '' : 'badge--success'}`}>
                  {llm.isMock ? 'offline mock agent' : `${llm.providerLabel} · ${llm.model}`}
                </span>
              )}
            </div>
            <p className="card__body">
              The build agent runs a tool loop: it plans, writes files, delegates to subagents and
              reviews its own work. Pick a provider to use a real model, or leave it on the offline
              mock so nothing leaves your machine.
            </p>

            <div className="grid grid--2" style={{ marginTop: 18, gap: 14 }}>
              <div className="field">
                <label htmlFor="provider">Provider</label>
                <select
                  id="provider"
                  className="input"
                  value={settings.llm.provider || 'mock'}
                  onChange={(e) => saveLlm({ provider: e.target.value })}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.id === 'mock' ? ' (no network)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="model">Model</label>
                <input
                  id="model"
                  className="input"
                  placeholder={llm?.model || 'e.g. gpt-4o-mini'}
                  value={settings.llm.model || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, llm: { ...s.llm, model: e.target.value } }))}
                  onBlur={(e) => saveLlm({ model: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="baseUrl">Base URL</label>
                <input
                  id="baseUrl"
                  className="input"
                  placeholder={llm?.baseUrl || 'https://api.openai.com/v1'}
                  value={settings.llm.baseUrl || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, llm: { ...s.llm, baseUrl: e.target.value } }))}
                  onBlur={(e) => saveLlm({ baseUrl: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="apiKey">API key</label>
                <input
                  id="apiKey"
                  className="input"
                  type="password"
                  autoComplete="off"
                  placeholder={settings.llm.hasApiKey ? '•••••••• (saved)' : 'sk-…'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={() => apiKey && saveLlm({})}
                />
                <span className="subtle" style={{ fontSize: 12 }}>
                  Encrypted with AES-256-GCM before it is stored. Leave blank to keep the current key.
                </span>
              </div>
            </div>

            <div className="grid grid--3" style={{ marginTop: 14, gap: 14 }}>
              <div className="field">
                <label htmlFor="maxIterations">Max iterations</label>
                <input
                  id="maxIterations"
                  className="input"
                  type="number"
                  min={1}
                  max={50}
                  value={settings.llm.maxIterations}
                  onChange={(e) => setSettings((s) => ({ ...s, llm: { ...s.llm, maxIterations: Number(e.target.value) } }))}
                  onBlur={(e) => saveLlm({ maxIterations: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="reviewRounds">Review rounds</label>
                <input
                  id="reviewRounds"
                  className="input"
                  type="number"
                  min={0}
                  max={5}
                  value={settings.llm.reviewRounds}
                  onChange={(e) => setSettings((s) => ({ ...s, llm: { ...s.llm, reviewRounds: Number(e.target.value) } }))}
                  onBlur={(e) => saveLlm({ reviewRounds: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="contextTokens">Context window (tokens)</label>
                <input
                  id="contextTokens"
                  className="input"
                  type="number"
                  min={1000}
                  step={1000}
                  value={settings.llm.contextTokens}
                  onChange={(e) => setSettings((s) => ({ ...s, llm: { ...s.llm, contextTokens: Number(e.target.value) } }))}
                  onBlur={(e) => saveLlm({ contextTokens: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="row row--wrap" style={{ marginTop: 16 }}>
              <label className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(settings.llm.subagents)}
                  onChange={(e) => saveLlm({ subagents: e.target.checked })}
                />
                Enable subagents
              </label>
              <button className="btn btn--ghost btn--sm" onClick={runTest} disabled={testing}>
                {testing ? <span className="spinner" /> : 'Test connection'}
              </button>
              {testResult && (
                <span className={`badge ${testResult.ok ? 'badge--success' : 'alert--error'}`}>
                  {testResult.ok ? `OK — ${testResult.message}` : testResult.message}
                </span>
              )}
            </div>

            {subagents.length > 0 && (
              <div className="row row--wrap" style={{ marginTop: 14, gap: 6 }}>
                {subagents.map((s) => (
                  <span className="badge" key={s.id} title={s.description}>
                    ↳ {s.label}
                  </span>
                ))}
              </div>
            )}

            {environment?.keyFromEnv && (
              <p className="subtle" style={{ fontSize: 12, marginTop: 12 }}>
                A provider key was found in the server environment — it is used unless you store your
                own key here.
              </p>
            )}
          </section>

          {/* ---------------------------------------------- appearance */}
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

          {/* ------------------------------------------------ API keys */}
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
              <div
                className="alert"
                style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              >
                {newKey}
                <br />
                <span className="subtle">Copy it now — it will not be shown again.</span>
              </div>
            )}

            <div className="stack" style={{ marginTop: 18 }}>
              {keys.length === 0 && (
                <p className="muted" style={{ fontSize: 14 }}>
                  No API keys yet.
                </p>
              )}
              {keys.map((k) => (
                <div
                  className="row"
                  key={k.id}
                  style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
                >
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
