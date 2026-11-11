import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PromptBox from '../components/PromptBox.jsx';
import api from '../lib/api.js';

const CARDS = [
  {
    title: 'You bring the idea. Lovable brings it to life.',
    body: 'Describe what you want in plain language. Watch as Lovable builds production-grade software with you in real time.',
    visual: 'prompt',
  },
  {
    title: 'Refine your design and deploy',
    body: 'Iterate on your creation until you’re happy with the finished product. Then ship your idea and start using it immediately.',
    visual: 'preview',
  },
  {
    title: 'Depend on Lovable, from end to end',
    body: 'Lovable handles your end-to-end infrastructure – from hosting and authentication to payments and integrations.',
    visual: 'sidebar',
  },
];

const ACCORDION = [
  {
    title: 'Hosting, handled',
    body: 'Lovable handles hosting, SSL, and backend infrastructure. Your code and data stay yours. Always.',
  },
  {
    title: 'Your app stack, connected',
    body: 'Connect to your tech stack, and build from the tools you already use. No integration code to write or maintain.',
  },
  {
    title: 'Payments, processed',
    body: 'Local payments, currency conversion, and tax compliance handled in 200+ countries and territories.',
  },
  {
    title: 'Safe and secure, as standard',
    body: 'Meet security and compliance requirements with automatic scans and audit logs.',
  },
  {
    title: 'Works wherever, whenever',
    body: 'Build and manage your projects on web, desktop, and mobile, or from your favorite tools and platforms.',
  },
];

const BRANDS = ['Adidas', 'Asana', 'ElevenLabs', 'Zendesk', 'Workday', 'Nvidia'];

const STORIES = [
  {
    company: 'eXp Realty',
    body: 'eXp Realty has cancelled millions in SaaS contracts for custom software built with Lovable.',
    quote:
      'When I realized Lovable could make whatever I wanted, I was like ‘Holy shit, this is the best thing I’ve ever seen in my life’.',
    person: 'Andreas Melander',
    role: 'Co-founder',
    metrics: [
      ['$2M+', 'savings per year'],
      ['85%', 'fewer support tickets'],
      ['83K', 'remote agents connected'],
    ],
  },
  {
    company: 'Klar',
    body: 'These three students created an AI system from the ground up to help anyone learn faster.',
    quote: 'We shipped our first version in a weekend and had 2,500 users signed up in two days.',
    person: 'Klar team',
    role: 'Founders',
    metrics: [
      ['€130K', 'ARR in 30 days'],
      ['2500+', 'users signed up in two days'],
      ['€7.5M', 'ARR partnership announced'],
    ],
  },
  {
    company: 'The Scion Group',
    body: 'The Scion Group is all-in on Lovable, with every department building custom tools to streamline their workflows.',
    quote: 'Every team now builds the tools they need instead of waiting on a backlog.',
    person: 'Scion Ops',
    role: 'Operations',
    metrics: [
      ['$1M+', 'SaaS contracts on track to be retired'],
      ['100+', 'apps deployed in under four months'],
      ['$35K', 'saved on the very first build'],
    ],
  },
];

function CardVisual({ kind }) {
  if (kind === 'prompt') {
    return (
      <div
        style={{
          borderRadius: 14,
          padding: 26,
          minHeight: 190,
          display: 'grid',
          placeItems: 'center',
          background:
            'linear-gradient(135deg, hsl(216 73% 94%), hsl(330 82% 93%) 60%, hsl(40 80% 94%))',
        }}
      >
        <div
          style={{
            width: '100%',
            background: '#fff',
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 10px 30px -18px rgba(0,0,0,.45)',
            color: 'hsl(60 1% 55%)',
            fontSize: 15,
          }}
        >
          Create an online store...
        </div>
      </div>
    );
  }

  if (kind === 'preview') {
    return (
      <div
        style={{
          borderRadius: 14,
          padding: 18,
          minHeight: 190,
          background: 'hsl(45 30% 97%)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <span className="badge badge--accent">🌐 Preview</span>
          <span className="badge">📄</span>
          <span className="badge">⌘</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.02em' }}>
          Bug tracking for teams that ship fast
        </div>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
          Purpose-built for engineering teams. Triage, track, and resolve issues without slowing
          down.
        </p>
        <span className="btn btn--ghost btn--sm" style={{ marginTop: 14 }}>
          Get started for free
        </span>
      </div>
    );
  }

  const items = ['Analytics', 'Cloud', 'Connectors', 'Security', 'Agent integrations', 'Payments', 'SEO & AI search'];
  return (
    <div
      style={{
        borderRadius: 14,
        padding: 18,
        minHeight: 190,
        background: 'hsl(45 30% 97%)',
        border: '1px solid var(--border)',
        display: 'flex',
        gap: 16,
      }}
    >
      <div style={{ width: 150, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item, i) => (
          <span
            key={item}
            style={{
              fontSize: 13,
              padding: '5px 9px',
              borderRadius: 8,
              background: i === 1 ? 'var(--muted)' : 'transparent',
              color: i > 3 ? 'var(--fg-subtle)' : 'var(--fg-muted)',
            }}
          >
            {item}
          </span>
        ))}
      </div>
      <div
        style={{
          flex: 1,
          borderRadius: 10,
          background: 'hsl(45 17% 91%)',
          minHeight: 150,
        }}
      />
    </div>
  );
}

export default function Landing() {
  const [stats, setStats] = useState(null);
  const [openPanel, setOpenPanel] = useState(0);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="hero">
        <div className="container">
          <h1 className="hero__title">Build something Lovable</h1>
          <p className="hero__subtitle">
            Bring a new product, internal tool, or entire company to life.
          </p>
          <PromptBox />
          <p className="hero__meta">
            Free to start · No credit card required · React + Express + SQLite
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- platform */}
      <section className="section section--tight">
        <div className="container">
          <div style={{ maxWidth: 620 }}>
            <h2 className="split__title">One platform.</h2>
            <p className="split__text">
              If you can describe it, you can build it. Create, run, and manage entire products and
              businesses from scratch.
            </p>
          </div>
          <div className="grid grid--3" style={{ marginTop: 36 }}>
            {CARDS.map((card) => (
              <article className="card card--hover" key={card.title}>
                <CardVisual kind={card.visual} />
                <h3 className="card__title" style={{ marginTop: 18 }}>
                  {card.title}
                </h3>
                <p className="card__body">{card.body}</p>
              </article>
            ))}
          </div>
          <div className="row" style={{ marginTop: 26 }}>
            <Link className="btn btn--accent" to="/signup">
              Get started for free
            </Link>
            <Link className="btn btn--ghost" to="/templates">
              Browse templates
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ dark band */}
      <section className="section section--tight">
        <div className="container">
          <div className="dark-band">
            <div className="dark-band__inner">
              <div>
                <h2>For building</h2>
                <p className="dark-band__text">
                  Lovable runs on enterprise-grade infrastructure – so you can create full-stack
                  software that scales.
                </p>
                <div className="accordion">
                  {ACCORDION.map((item, i) => (
                    <div className="accordion__item" key={item.title}>
                      <button
                        className="accordion__trigger"
                        onClick={() => setOpenPanel(openPanel === i ? -1 : i)}
                        aria-expanded={openPanel === i}
                      >
                        {item.title}
                        <span className="accordion__icon">{openPanel === i ? '−' : '+'}</span>
                      </button>
                      {openPanel === i && <div className="accordion__panel">{item.body}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="dark-band__visual">
                <div className="dark-band__orb">WEB</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- brands */}
      <section className="section section--tight">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 34 }}>
            <h2 className="split__title">Trusted by top brands</h2>
            <p className="split__text" style={{ maxWidth: '56ch', marginInline: 'auto' }}>
              Top companies empower their employees to create with Lovable. Join them today and build
              the software that runs your business.
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
              <Link className="btn btn--ghost btn--sm" to="/community">
                Learn more
              </Link>
            </div>
          </div>
          <div className="logo-row">
            {BRANDS.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- stories */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 34px' }}>
            <h2 className="split__title">
              The proof is in
              <br />
              production
            </h2>
            <p className="split__text">
              These companies built the software they needed with Lovable. Now they run their
              businesses on it.
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
              <Link className="btn btn--quiet btn--sm" to="/community">
                See all customer stories →
              </Link>
            </div>
          </div>

          <div className="carousel">
            {STORIES.map((story) => (
              <article className="story" key={story.company}>
                <div className="row" style={{ gap: 12 }}>
                  <span className="brand__mark" aria-hidden="true">
                    {story.company.slice(0, 1)}
                  </span>
                  <strong>{story.company}</strong>
                </div>
                <div className="story__top">
                  <div>
                    <p className="muted" style={{ fontSize: 14 }}>
                      {story.body}
                    </p>
                    <p className="story__quote" style={{ marginTop: 18 }}>
                      {story.quote}
                    </p>
                  </div>
                  <div className="story__metrics">
                    {story.metrics.map(([value, label]) => (
                      <div key={label}>
                        <div className="story__value">{value}</div>
                        <div className="story__label">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="story__foot">
                  <span className="avatar" aria-hidden="true" />
                  <span style={{ fontSize: 13 }}>
                    <strong style={{ display: 'block' }}>{story.person}</strong>
                    <span className="muted">{story.role}</span>
                  </span>
                  <Link className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} to="/community">
                    Read story →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- stats */}
      <section className="section section--tight">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 44px' }}>
            <h2 className="split__title">Millions count on Lovable</h2>
            <p className="split__text">
              People across the world are using Lovable every day to solve problems and seize
              opportunities. Join them now and turn ‘someday’ into today.
            </p>
          </div>
          <div className="stats">
            <div>
              <div className="stat__value">1.2 million</div>
              <div className="stat__label">New projects built every week</div>
            </div>
            <div>
              <div className="stat__value">60 million</div>
              <div className="stat__label">Projects built with Lovable</div>
            </div>
            <div>
              <div className="stat__value">900 million</div>
              <div className="stat__label">Monthly visits to Lovable-built projects</div>
            </div>
          </div>
          {stats?.database && (
            <p className="subtle" style={{ textAlign: 'center', marginTop: 26, fontSize: 13 }}>
              This clone is live right now — {stats.database.projects} projects and{' '}
              {stats.database.users} accounts in the local SQLite database.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="section section--tight">
        <div className="container">
          <div style={{ textAlign: 'center' }}>
            <h2 className="split__title">AI App Builder</h2>
            <p className="split__text" style={{ maxWidth: '54ch', margin: '10px auto 0' }}>
              Ready to bring your idea to life? Describe it and watch it come to life.
            </p>
          </div>
          <PromptBox compact />
          <div className="row" style={{ justifyContent: 'center', marginTop: 26 }}>
            <Link className="btn btn--accent btn--lg" to="/signup">
              Get started for free
            </Link>
            <Link className="btn btn--ghost btn--lg" to="/templates">
              Explore templates
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
