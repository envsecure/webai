import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api.js';

const TABS = [
  { id: 'preview', label: 'Preview' },
  { id: 'code', label: 'Code' },
  { id: 'versions', label: 'Versions' },
];

export default function Builder() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [versions, setVersions] = useState([]);
  const [files, setFiles] = useState({});
  const [tab, setTab] = useState('preview');
  const [activeFile, setActiveFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  async function load() {
    const res = await api.getProject(projectId);
    setProject(res.project);
    const list = res.versions || [];
    setVersions(list);
    // Show the most recent generated build straight away.
    if (list.length && Object.keys(files).length === 0) {
      setFiles(list[0].code || {});
      setActiveFile(Object.keys(list[0].code || {})[0] || null);
    }
    const msg = await api.projectMessages(projectId);
    setMessages(msg.messages || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const fileList = useMemo(() => Object.keys(files), [files]);

  async function send(event) {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    setPrompt('');
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'user', content: text }]);
    try {
      const res = await api.chat(projectId, { prompt: text });
      setFiles(res.files || {});
      setMessages(res.messages || []);
      setVersions((await api.versions(projectId)).versions || []);
      setProject((await api.getProject(projectId)).project);
      setTab('preview');
    } catch (err) {
      setError(err.message || 'Build failed');
    } finally {
      setBusy(false);
    }
  }

  async function restoreVersion(version) {
    setFiles(version.code || {});
    setTab('code');
  }

  if (!project) {
    return (
      <div className="app-main" style={{ paddingTop: 60 }}>
        {error ? <div className="alert alert--error">{error}</div> : <div className="skeleton" style={{ height: 240 }} />}
      </div>
    );
  }

  return (
    <div className="builder">
      {/* ------------------------------------------------------- chat side */}
      <section className="builder__chat">
        <header className="builder__head">
          <Link className="btn btn--quiet btn--sm" to="/app">
            ←
          </Link>
          <div className="grow">
            <div style={{ fontWeight: 600, fontSize: 15 }}>{project.name}</div>
            <div className="subtle" style={{ fontSize: 12 }}>
              {project.stack} · {project.status}
            </div>
          </div>
          <span className="badge">{project.messagesCount} messages</span>
        </header>

        <div className="builder__messages">
          {messages.length === 0 && (
            <div className="empty" style={{ padding: 32 }}>
              <p style={{ fontWeight: 600, color: 'var(--fg)' }}>Start building</p>
              <p style={{ marginTop: 6, fontSize: 14 }}>
                Ask for a feature and the app is regenerated with it.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div className={`msg msg--${m.role}`} key={m.id}>
              <div className="msg__bubble">{m.content}</div>
              {m.meta?.plan && (
                <div className="plan" style={{ width: '100%' }}>
                  {m.meta.plan.map((step) => (
                    <div className="plan__row" key={step.step}>
                      <span className="plan__step">{step.step}</span>
                      <span className="plan__detail">{step.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              <span className="msg__meta">
                {m.role} · {new Date(m.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}

          {busy && (
            <div className="msg msg--assistant">
              <div className="msg__bubble row" style={{ gap: 10 }}>
                <span className="spinner" /> Building your app…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={send}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a change…"
            aria-label="Message"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
          />
          <button className="btn btn--accent" type="submit" disabled={!prompt.trim() || busy}>
            Send
          </button>
        </form>
        {error && (
          <div className="alert alert--error" style={{ margin: '0 16px 14px' }}>
            {error}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------- preview side */}
      <section className="builder__preview">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
          {tab === 'code' && fileList.length > 0 && (
            <span className="row row--wrap" style={{ gap: 4, marginLeft: 'auto' }}>
              {fileList.map((f) => (
                <button
                  key={f}
                  className={`tab ${activeFile === f ? 'tab--active' : ''}`}
                  onClick={() => setActiveFile(f)}
                >
                  {f.split('/').pop()}
                </button>
              ))}
            </span>
          )}
        </div>

        {tab === 'preview' && (
          <div style={{ padding: 20, overflow: 'auto' }}>
            {fileList.length === 0 ? (
              <div className="empty" style={{ padding: 48, textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: 'var(--fg)' }}>Nothing generated yet</p>
                <p style={{ marginTop: 6, fontSize: 14 }}>
                  Send a message to generate the app files.
                </p>
              </div>
            ) : (
              <div className="card">
                <h3 className="card__title">{project.name}</h3>
                <p className="card__body">{project.description}</p>
                <div className="row row--wrap" style={{ marginTop: 16 }}>
                  {fileList.map((f) => (
                    <span className="badge mono" key={f}>
                      {f}
                    </span>
                  ))}
                </div>
                <div className="stack" style={{ marginTop: 20 }}>
                  {Object.entries(files).map(([name, content]) => (
                    <details key={name}>
                      <summary style={{ cursor: 'pointer', fontSize: 14 }}>{name}</summary>
                      <pre className="code" style={{ marginTop: 8, borderRadius: 12, background: 'var(--muted)' }}>
                        {content}
                      </pre>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'code' && (
          <pre className="code">
            {fileList.length === 0
              ? 'No code generated yet.'
              : files[activeFile || fileList[0]] || 'Select a file above.'}
          </pre>
        )}

        {tab === 'versions' && (
          <div className="version-list">
            {versions.length === 0 && <p className="muted">No versions yet.</p>}
            {versions.map((v) => (
              <button className="version" key={v.id} onClick={() => restoreVersion(v)}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{v.label}</strong>
                  <span className="subtle" style={{ fontSize: 12 }}>
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {v.summary}
                </p>
                <span className="badge" style={{ marginTop: 8 }}>
                  {Object.keys(v.code || {}).length} files
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
