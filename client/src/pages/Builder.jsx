import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import { describeEvent, streamChat } from '../lib/agent.js';

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
  const [plan, setPlan] = useState([]);
  const [tab, setTab] = useState('preview');
  const [activeFile, setActiveFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feed, setFeed] = useState([]);
  const [agentInfo, setAgentInfo] = useState(null);
  const [needsModel, setNeedsModel] = useState(false);
  const [showFeed, setShowFeed] = useState(true);
  const endRef = useRef(null);

  async function load() {
    const res = await api.getProject(projectId);
    setProject(res.project);
    const list = res.versions || [];
    setVersions(list);
    if (list.length && Object.keys(files).length === 0) {
      setFiles(list[0].code || {});
      setActiveFile(Object.keys(list[0].code || {})[0] || null);
    }
    const msg = await api.projectMessages(projectId);
    setMessages(msg.messages || []);
    const lastAssistant = [...(msg.messages || [])].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant?.meta?.plan) setPlan(lastAssistant.meta.plan);
    if (lastAssistant?.meta?.agent) setAgentInfo(lastAssistant.meta.agent);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, feed.length]);

  const fileList = useMemo(() => Object.keys(files), [files]);

  async function send(event, textOverride) {
    event?.preventDefault();
    const text = (textOverride ?? prompt).trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    setPrompt('');
    setFeed([]);
    setShowFeed(true);
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'user', content: text }]);

    try {
      await streamChat(projectId, text, {
        onEvent: (evt) => {
          if (evt.type === 'agent_event') {
            const described = describeEvent(evt.event);
            if (described) {
              setFeed((f) => [...f, { ...described, id: `${Date.now()}-${f.length}` }]);
            }
          } else if (evt.type === 'user_message') {
            setFeed((f) => [...f, { kind: 'phase', text: 'Phase: build', id: `phase-${f.length}` }]);
          } else if (evt.type === 'error') {
            if (evt.code === 'no_model_configured') setNeedsModel(true);
            setError(evt.message || 'The build failed');
          }
        },
      });

      const [msg, vers] = await Promise.all([
        api.projectMessages(projectId),
        api.versions(projectId),
      ]);
      setMessages(msg.messages || []);
      setVersions(vers.versions || []);
      const updated = await api.getProject(projectId);
      setProject(updated.project);
      const latest = (vers.versions || [])[0];
      if (latest) {
        setFiles(latest.code || {});
        setActiveFile(Object.keys(latest.code || {})[0] || null);
      }
      const lastAssistant = [...(msg.messages || [])].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant?.meta?.plan) setPlan(lastAssistant.meta.plan);
      if (lastAssistant?.meta?.agent) setAgentInfo(lastAssistant.meta.agent);
      setTab('preview');
    } catch (err) {
      setError(err.message || 'The build failed');
      if (err.status === 409 || err.code === 'no_model_configured') {
        setNeedsModel(true);
      }
    } finally {
      setBusy(false);
    }
  }

  // A project created from a prompt starts its build as soon as it is opened.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!project || autoStarted.current) return;
    if (project.prompt && versions.length === 0) {
      autoStarted.current = true;
      send(null, project.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, versions.length]);

  async function restoreVersion(version) {
    setFiles(version.code || {});
    setActiveFile(Object.keys(version.code || {})[0] || null);
    setTab('code');
  }

  if (!project) {
    return (
      <div className="app-main" style={{ paddingTop: 60 }}>
        {error ? (
          <div className="alert alert--error">{error}</div>
        ) : (
          <div className="skeleton" style={{ height: 240 }} />
        )}
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
                Ask for a feature and the agent plans it, writes the files and reviews its own work.
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
              {m.meta?.agent && (
                <div className="agent-meta">
                  <span className="agent-meta__item">
                    {m.meta.agent.provider || 'local'}
                    {m.meta.agent.model ? ` · ${m.meta.agent.model}` : ''}
                  </span>
                  {m.meta.agent.iterations ? (
                    <span className="agent-meta__item">{m.meta.agent.iterations} iterations</span>
                  ) : null}
                  {m.meta.agent.usage?.total_tokens ? (
                    <span className="agent-meta__item">{m.meta.agent.usage.total_tokens} tokens</span>
                  ) : null}
                  {(m.meta.agent.subagents || []).map((s) => (
                    <span className="agent-meta__item" key={s.id}>
                      ↳ {s.label} ({s.iterations})
                    </span>
                  ))}
                  {m.meta.agent.usedFallback ? (
                    <span className="agent-meta__item">local generator fallback</span>
                  ) : null}
                </div>
              )}
              <span className="msg__meta">
                {m.role} · {new Date(m.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}

          {(feed.length > 0 || busy) && (
            <div className="stack" style={{ gap: 8 }}>
              <button
                className="btn btn--quiet btn--sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowFeed((v) => !v)}
              >
                {showFeed ? '▾' : '▸'} Agent activity
                {busy ? ' · running…' : ''}
              </button>
              {showFeed && (
                <div className="feed">
                  {feed.map((row) => (
                    <div className={`feed__row feed__row--${row.kind}`} key={row.id}>
                      <span>{row.text}</span>
                    </div>
                  ))}
                  {busy && (
                    <div className="feed__row feed__row--iteration">
                      <span className="spinner" /> working…
                    </div>
                  )}
                </div>
              )}
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
            {busy ? <span className="spinner" /> : 'Send'}
          </button>
        </form>

        {needsModel && (
          <div className="alert alert--error" style={{ margin: '0 16px 14px' }}>
            <strong>No model is connected.</strong> The agent needs an OpenAI-compatible endpoint
            before it can build. Add your API endpoint, key and model in Settings → Model
            connection.
            <div className="row" style={{ marginTop: 10 }}>
              <Link className="btn btn--accent btn--sm" to="/app/settings">
                Open model settings
              </Link>
            </div>
          </div>
        )}

        {error && !needsModel && (
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
            {plan.length > 0 && (
              <div className="plan" style={{ marginBottom: 18 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  Build plan
                </div>
                {plan.map((step) => (
                  <div className="plan__row" key={step.step}>
                    <span className="plan__step">{step.step}</span>
                    <span className="plan__detail">{step.detail}</span>
                  </div>
                ))}
              </div>
            )}

            {fileList.length === 0 ? (
              <div className="empty" style={{ padding: 48, textAlign: 'center' }}>
                <p style={{ fontWeight: 600, color: 'var(--fg)' }}>Nothing generated yet</p>
                <p style={{ marginTop: 6, fontSize: 14 }}>
                  Send a message and the agent will plan, write and review an app.
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
                  {fileList.map((name) => (
                    <details key={name}>
                      <summary style={{ cursor: 'pointer', fontSize: 14 }}>{name}</summary>
                      <pre
                        className="code"
                        style={{ marginTop: 8, borderRadius: 12, background: 'var(--muted)' }}
                      >
                        {files[name]}
                      </pre>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {agentInfo && (
              <div className="agent-meta" style={{ marginTop: 18 }}>
                <span className="agent-meta__item">
                  provider: {agentInfo.provider || 'local'}
                  {agentInfo.model ? ` (${agentInfo.model})` : ''}
                </span>
                {agentInfo.iterations ? (
                  <span className="agent-meta__item">{agentInfo.iterations} iterations</span>
                ) : null}
                {agentInfo.usage?.total_tokens ? (
                  <span className="agent-meta__item">{agentInfo.usage.total_tokens} tokens</span>
                ) : null}
                {agentInfo.context?.compactions ? (
                  <span className="agent-meta__item">
                    {agentInfo.context.compactions} context compaction(s)
                  </span>
                ) : null}
                {(agentInfo.subagents || []).map((s) => (
                  <span className="agent-meta__item" key={s.id}>
                    ↳ {s.label}: {s.iterations} iteration(s)
                  </span>
                ))}
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
