import { useEffect, useState } from 'react';
import api from '../lib/api.js';

const PROVIDER_HINTS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  ollama: 'http://127.0.0.1:11434/v1',
  compatible: 'http://127.0.0.1:8000/v1',
};

/**
 * Connect a model.
 *
 * Accepts any OpenAI-compatible endpoint. "Detect" probes the endpoint to
 * work out the model catalogue, the context window and whether tool calling
 * works - the agent needs tool calling.
 */
export default function ModelSetup({ settings, llm, providers = [], onSaved }) {
  const [provider, setProvider] = useState(settings?.llm?.provider || 'compatible');
  const [baseUrl, setBaseUrl] = useState(settings?.llm?.baseUrl || '');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(settings?.llm?.model || '');
  const [contextTokens, setContextTokens] = useState(settings?.llm?.contextTokens || 24000);
  const [maxIterations, setMaxIterations] = useState(settings?.llm?.maxIterations || 12);
  const [reviewRounds, setReviewRounds] = useState(settings?.llm?.reviewRounds ?? 1);
  const [subagents, setSubagents] = useState(settings?.llm?.subagents !== false);

  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setProvider(settings?.llm?.provider || 'compatible');
    setBaseUrl(settings?.llm?.baseUrl || '');
    setModel(settings?.llm?.model || '');
    setContextTokens(settings?.llm?.contextTokens || 24000);
    setMaxIterations(settings?.llm?.maxIterations || 12);
    setReviewRounds(settings?.llm?.reviewRounds ?? 1);
    setSubagents(settings?.llm?.subagents !== false);
  }, [settings]);

  // Fill the default base URL when a provider is picked.
  function pickProvider(id) {
    setProvider(id);
    const hint = PROVIDER_HINTS[id];
    if (hint && !baseUrl) setBaseUrl(hint);
    setDetection(null);
  }

  async function detect() {
    setDetecting(true);
    setMessage(null);
    try {
      const result = await api.detectModel({ provider, baseUrl, apiKey: apiKey || undefined, model });
      setDetection(result);
      if (result.model) setModel(result.model);
      if (result.contextTokens) setContextTokens(result.contextTokens);
      setMessage({ ok: true, text: result.messages });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setDetecting(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const body = {
        llm: {
          provider,
          baseUrl,
          model,
          contextTokens: Number(contextTokens) || 24000,
          maxIterations: Number(maxIterations) || 12,
          reviewRounds: Number(reviewRounds) || 0,
          subagents,
          capabilities: detection
            ? {
                supportsTools: detection.supportsTools,
                reportsUsage: detection.reportsUsage,
                detectedAt: new Date().toISOString(),
              }
            : undefined,
        },
      };
      if (apiKey) body.llm.apiKey = apiKey;
      const res = await api.saveSettings(body);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setMessage({ ok: true, text: 'Saved. The agent will use this endpoint from now on.' });
      onSaved?.(res);
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setMessage(null);
    try {
      const res = await api.testLlm();
      setMessage({ ok: true, text: `Connected. ${res.provider} · ${res.model} replied "${res.reply}"` });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  }

  const connected = Boolean(llm?.configured);

  return (
    <section className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="card__title">Model connection</h2>
        {connected ? (
          <span className="badge badge--success">
            connected · {llm.providerLabel} · {llm.model}
          </span>
        ) : (
          <span className="badge badge--accent">not connected</span>
        )}
      </div>

      <p className="card__body">
        The build agent drives your model with tool calls, so it needs an endpoint that supports
        tools. Any OpenAI-compatible gateway works: OpenAI, Anthropic, OpenRouter, Groq, Together,
        Ollama, vLLM, LM Studio or your own gateway.
      </p>

      <div className="grid grid--2" style={{ marginTop: 18, gap: 14 }}>
        <div className="field">
          <label htmlFor="provider">Provider</label>
          <select
            id="provider"
            className="input"
            value={provider}
            onChange={(e) => pickProvider(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="baseUrl">Base URL</label>
          <input
            id="baseUrl"
            className="input"
            placeholder={PROVIDER_HINTS[provider] || 'https://api.openai.com/v1'}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="apiKey">API key</label>
          <input
            id="apiKey"
            className="input"
            type="password"
            autoComplete="off"
            placeholder={settings?.llm?.hasApiKey ? '•••••••• (saved)' : 'sk-…'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <span className="subtle" style={{ fontSize: 12 }}>
            Encrypted with AES-256-GCM before it is stored. Leave blank to keep the saved key.
          </span>
        </div>

        <div className="field">
          <label htmlFor="model">Model</label>
          <input
            id="model"
            className="input"
            placeholder="gpt-4o-mini"
            list="model-options"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id="model-options">
            {(detection?.models || []).map((m) => (
              <option key={m.id} value={m.id} />
            ))}
          </datalist>
          <span className="subtle" style={{ fontSize: 12 }}>
            {detection?.models?.length
              ? `${detection.models.length} model(s) offered by this endpoint.`
              : 'Use Detect to list the models this endpoint serves.'}
          </span>
        </div>
      </div>

      <div className="row row--wrap" style={{ marginTop: 16 }}>
        <button className="btn btn--ghost btn--sm" onClick={detect} disabled={detecting || !baseUrl}>
          {detecting ? <span className="spinner" /> : 'Detect'}
        </button>
        <button className="btn btn--accent btn--sm" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" /> : saved ? 'Saved' : 'Save connection'}
        </button>
        <button className="btn btn--quiet btn--sm" onClick={test} disabled={!connected}>
          Test connection
        </button>
      </div>

      {detection && (
        <div className="agent-meta" style={{ marginTop: 14 }}>
          <span className="agent-meta__item">
            models: {detection.models?.length ?? 0}
          </span>
          <span className="agent-meta__item">
            context:{' '}
            {detection.contextTokens
              ? `${detection.contextTokens.toLocaleString()} tokens`
              : 'not reported'}
          </span>
          <span className="agent-meta__item">
            tools:{' '}
            {detection.supportsTools === true
              ? 'supported'
              : detection.supportsTools === false
                ? 'not supported'
                : 'unknown'}
          </span>
          <span className="agent-meta__item">
            usage: {detection.reportsUsage ? 'reported' : 'not reported'}
          </span>
        </div>
      )}

      {message && (
        <div className={`alert ${message.ok ? '' : 'alert--error'}`} style={{ marginTop: 14 }}>
          {Array.isArray(message.text) ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {message.text.map((line, i) => (
                <li key={i} style={{ fontSize: 13.5 }}>
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            message.text
          )}
        </div>
      )}

      <hr className="divider" style={{ margin: '20px 0 16px' }} />

      <div className="grid grid--3" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="maxIterations">Max iterations</label>
          <input
            id="maxIterations"
            className="input"
            type="number"
            min={1}
            max={50}
            value={maxIterations}
            onChange={(e) => setMaxIterations(e.target.value)}
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
            value={reviewRounds}
            onChange={(e) => setReviewRounds(e.target.value)}
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
            value={contextTokens}
            onChange={(e) => setContextTokens(e.target.value)}
          />
        </div>
      </div>

      <label className="row" style={{ gap: 8, marginTop: 14 }}>
        <input
          type="checkbox"
          checked={subagents}
          onChange={(e) => setSubagents(e.target.checked)}
        />
        Enable subagents (the agent delegates focused work to specialists)
      </label>
    </section>
  );
}
