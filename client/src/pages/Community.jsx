import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';

export default function Community() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .community({ search })
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

  async function like(id) {
    const res = await api.likeProject(id);
    setProjects((list) => list.map((p) => (p.id === id ? res.project : p)));
  }

  return (
    <>
      <section className="hero" style={{ paddingBlock: '72px 32px' }}>
        <div className="container">
          <span className="eyebrow">Community</span>
          <h1 className="hero__title" style={{ fontSize: 'clamp(32px, 5vw, 54px)', maxWidth: '20ch' }}>
            Built with Lovable
          </h1>
          <p className="hero__subtitle">
            Real apps from the community. Clone one, remix it, or start your own.
          </p>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <input
            className="input"
            style={{ maxWidth: 320, marginBottom: 24 }}
            placeholder="Search community projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading ? (
            <div className="grid grid--3">
              {[0, 1, 2].map((i) => (
                <div className="skeleton" key={i} style={{ height: 220 }} />
              ))}
            </div>
          ) : (
            <div className="grid grid--3">
              {projects.map((p) => (
                <article className="card card--hover" key={p.id}>
                  <div className="row" style={{ gap: 12 }}>
                    {p.authorAvatar ? (
                      <img className="avatar" src={p.authorAvatar} alt="" loading="lazy" />
                    ) : (
                      <span className="avatar" />
                    )}
                    <span style={{ fontSize: 13 }} className="muted">
                      @{p.author}
                    </span>
                  </div>
                  <h3 className="card__title" style={{ marginTop: 14 }}>
                    {p.title}
                  </h3>
                  <p className="card__body">{p.description}</p>
                  <div className="row row--wrap" style={{ marginTop: 12 }}>
                    {p.tags.map((t) => (
                      <span className="badge" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="row" style={{ marginTop: 18 }}>
                    <button className="btn btn--quiet btn--sm" onClick={() => like(p.id)}>
                      ♥ {p.likes.toLocaleString()}
                    </button>
                    <Link
                      className="btn btn--ghost btn--sm"
                      style={{ marginLeft: 'auto' }}
                      to="/signup"
                    >
                      Use as template
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="empty">Nothing found. Try another search.</div>
          )}
        </div>
      </section>
    </>
  );
}
