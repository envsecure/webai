import { Link } from 'react-router-dom';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'Explore what Lovable can do for you.',
    features: [
      '5 active projects',
      'Community templates',
      'Local SQLite database',
      'Export your code',
    ],
    cta: 'Start building',
    accent: false,
  },
  {
    name: 'Pro',
    price: '$25',
    cadence: 'per month',
    description: 'For solo makers shipping real products.',
    features: [
      'Unlimited projects',
      'Version history & rollback',
      'Custom domains',
      'Priority builds',
      'API access',
    ],
    cta: 'Start 14-day trial',
    accent: true,
  },
  {
    name: 'Team',
    price: '$50',
    cadence: 'per seat / month',
    description: 'For teams building internal tools together.',
    features: [
      'Everything in Pro',
      'Shared workspaces',
      'Role-based access',
      'Audit logs',
      'SSO & SCIM',
    ],
    cta: 'Talk to sales',
    accent: false,
  },
];

export default function Pricing() {
  return (
    <>
      <section className="hero" style={{ paddingBlock: '80px 40px' }}>
        <div className="container">
          <span className="eyebrow">Pricing</span>
          <h1 className="hero__title" style={{ fontSize: 'clamp(34px, 5vw, 58px)', maxWidth: '18ch' }}>
            Plans that scale with your ideas
          </h1>
          <p className="hero__subtitle">
            Start free, upgrade when your project takes off. Every plan includes the full React +
            Express + SQLite stack.
          </p>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="grid grid--3">
            {PLANS.map((plan) => (
              <div
                className="card"
                key={plan.name}
                style={
                  plan.accent
                    ? { borderColor: 'var(--accent-primary)', boxShadow: 'var(--shadow-lg)' }
                    : undefined
                }
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h3 className="card__title">{plan.name}</h3>
                  {plan.accent && <span className="badge badge--accent">Popular</span>}
                </div>
                <p className="card__body" style={{ marginTop: 4 }}>
                  {plan.description}
                </p>
                <div style={{ margin: '20px 0 6px' }}>
                  <span style={{ fontSize: 42, letterSpacing: '-0.04em', fontWeight: 600 }}>
                    {plan.price}
                  </span>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 14 }}>
                    {plan.cadence}
                  </span>
                </div>
                <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: '18px 0 22px' }}>
                  {plan.features.map((f) => (
                    <li key={f} className="row" style={{ gap: 8, fontSize: 14 }}>
                      <span style={{ color: 'var(--success)' }}>✓</span>
                      <span className="muted">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  className={`btn btn--block ${plan.accent ? 'btn--accent' : 'btn--ghost'}`}
                  to="/signup"
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="card" style={{ textAlign: 'center' }}>
            <h2 className="split__title" style={{ fontSize: 30 }}>
              Every app includes the whole stack
            </h2>
            <p className="split__text">
              A React front end, an Express API and a SQLite database — generated together, in one
              prompt.
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
              <span className="badge">React</span>
              <span className="badge">Vite</span>
              <span className="badge">Express</span>
              <span className="badge">SQLite</span>
              <span className="badge">REST</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
