import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api.js';

/**
 * The live preview.
 *
 * The generated project runs in its own sandbox (a Vite dev server plus the
 * generated Express API). This component shows it in an iframe, proxied
 * through the app so it lives on the same origin.
 */
export default function Preview({ projectId, files, refreshKey = 0 }) {
  const [state, setState] = useState({ status: 'stopped', mode: null, port: null });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [frameKey, setFrameKey] = useState(0);
  const iframeRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await api.sandboxStatus(projectId);
      setState(res.sandbox || { status: 'stopped' });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // Poll while the sandbox is starting.
  useEffect(() => {
    if (state.status !== 'starting') return undefined;
    const timer = setInterval(refresh, 1200);
    return () => clearInterval(timer);
  }, [state.status, refresh]);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.startSandbox(projectId);
      setState(res.sandbox);
      setFrameKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function restart() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.restartSandbox(projectId);
      setState(res.sandbox);
      setFrameKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const running = state.status === 'running';
  const src = running ? `/api/sandbox/${projectId}/?t=${frameKey}` : null;

  return (
    <div className="preview">
      <div className="preview__bar">
        <span className={`preview__dot preview__dot--${state.status}`} aria-hidden="true" />
        <span className="preview__status">
          {state.status === 'running'
            ? `Preview running (${state.mode})`
            : state.status === 'starting'
              ? 'Starting the preview…'
              : state.status === 'crashed'
                ? 'The preview crashed'
                : 'The preview is stopped'}
        </span>
        <span className="grow" />
        {running ? (
          <>
            <button className="btn btn--quiet btn--sm" onClick={restart} disabled={loading}>
              Restart
            </button>
            <button
              className="btn btn--quiet btn--sm"
              onClick={() => setFrameKey((k) => k + 1)}
              title="Reload the preview"
            >
              Reload
            </button>
          </>
        ) : (
          <button className="btn btn--accent btn--sm" onClick={start} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Start preview'}
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert--error" style={{ margin: 12 }}>
          {error}
        </div>
      )}

      <div className="preview__stage">
        {running ? (
          <iframe
            key={frameKey}
            ref={iframeRef}
            className="preview__frame"
            src={src}
            title="Live preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          />
        ) : (
          <div className="empty" style={{ border: 0 }}>
            <p style={{ fontWeight: 600, color: 'var(--fg)' }}>
              {Object.keys(files || {}).length
                ? 'The preview is not running'
                : 'Nothing to preview yet'}
            </p>
            <p style={{ marginTop: 6, fontSize: 14 }}>
              {Object.keys(files || {}).length
                ? 'Start it to run the generated app — the React front end and the Express API, together.'
                : 'Build a project and the preview starts automatically.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
