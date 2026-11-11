import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import api from '../lib/api.js';

const Icon = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  bolt: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9 1 3.5 9h4L7 15l5.5-8h-4L9 1Z"
        fill="currentColor"
      />
    </svg>
  ),
  mic: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="6" y="1.5" width="4" height="8" rx="2" fill="currentColor" />
      <path
        d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
};

export default function PromptBox({ compact = false, autoFocus = false, cta = 'Build' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setError('');

    if (!user) {
      navigate('/signup', { state: { prompt: text } });
      return;
    }

    setBusy(true);
    try {
      const res = await api.quickBuild(text);
      navigate(`/app/project/${res.project.id}`);
    } catch (err) {
      setError(err.message || 'Could not start the build');
      setBusy(false);
    }
  }

  return (
    <form className="prompt" onSubmit={submit} style={compact ? { marginTop: 0 } : undefined}>
      <textarea
        className="prompt__input"
        placeholder="Create an online store..."
        value={prompt}
        autoFocus={autoFocus}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        aria-label="Chat input"
      />
      {error && (
        <div className="alert alert--error" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div className="prompt__bar">
        <button type="button" className="prompt__icon" title="Attach a file" aria-label="Attach a file">
          {Icon.plus}
        </button>
        <button type="button" className="prompt__icon" title="Choose a model" aria-label="Choose a model">
          {Icon.bolt}
        </button>
        <span className="subtle" style={{ fontSize: 12 }}>
          {user ? `Signed in as ${user.name || user.email}` : 'Sign up to start building'}
        </span>
        <span className="prompt__label">{cta}</span>
        <button className="prompt__icon" type="button" title="Dictate" aria-label="Dictate">
          {Icon.mic}
        </button>
        <button className="prompt__send" type="submit" disabled={!prompt.trim() || busy} aria-label="Build">
          {busy ? (
            <span className="spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
