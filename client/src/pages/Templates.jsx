import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../App.jsx';

const CATEGORIES = ['all', 'commerce', 'dashboard', 'content', 'productivity', 'social', 'business', 'marketing'];

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .templates({ category: category === 'all' ? '' : category, search })
      .then((res) => {
        if (!cancelled) setTemplates(res.templates);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, search]);

  async function useTemplate(template) {
    try {
      await api.installTemplate(template.id);
    } catch {
      /* install count is best-effort */
    }
    if (!user) {
      navigate('/signup', { state: { prompt: template.prompt } });
      return;
    }
    const res = await api.quickBuild(template.prompt);
    navigate(`/app/project/${res.project.id}`);
  }

  return (
    <>
      <section className="hero" style={{ paddingBlock: '72px 32px' }}>
        <div className="container">
          <span className="eyebrow">Templates</span>
          <h1 className="hero__title" style={{ fontSize: 'clamp(32px, 5vw, 54px)', maxWidth: '20ch' }}>
            Start from a template
          </h1>
          <p className="hero__subtitle">
            Production-shaped starters for stores, dashboards, blogs and internal tools. Pick one and
            make it yours.
          </p>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="row row--wrap" style={{ marginBottom: 24 }}>
            <input
              className="input"
              style={{ maxWidth: 280 }}
              placeholder="Search templates"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="row row--wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={`prompt__chip ${category === c ? 'prompt__chip--active' : ''}`}
                  style={
                    category === c
                      ? { background: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'transparent' }
                      : undefined
                  }
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid--3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div className="skeleton" key={i} style={{ height: 210 }} />
              ))}
            </div>
          ) : (
            <div className="grid grid--3">
              {templates.map((t) => (
                <div className="card card--hover" key={t.id}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <h3 className="card__title">{t.name}</h3>
                    {t.verified && <span className="badge badge--success">Verified</span>}
                  </div>
                  <p className="card__body">{t.description}</p>
                  <div className="row row--wrap" style={{ marginTop: 12 }}>
                    {t.tags.map((tag) => (
                      <span className="badge" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="row" style={{ marginTop: 18 }}>
                    <span className="subtle" style={{ fontSize: 12 }}>
                      ⬇ {t.installs.toLocaleString()} · ★ {t.rating}
                    </span>
                    <button
                      className="btn btn--accent btn--sm"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => useTemplate(t)}
                    >
                      Use template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="empty">No templates match that search.</div>
          )}
        </div>
      </section>
    </>
  );
}
