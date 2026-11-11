import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import Brand from './Brand.jsx';

const LINKS = [
  { label: 'Solutions', to: '/#features' },
  { label: 'Templates', to: '/templates' },
  { label: 'Community', to: '/community' },
  { label: 'Pricing', to: '/pricing' },
];

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="nav">
      <div className="container nav__inner">
        <Brand />

        <nav className="nav__links" aria-label="Main">
          {LINKS.map((link) => (
            <NavLink key={link.label} to={link.to}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav__actions">
          {user ? (
            <>
              <Link className="btn btn--ghost btn--sm" to="/app">
                My projects
              </Link>
              <button
                className="btn btn--quiet btn--sm"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn--quiet btn--sm" to="/login">
                Log in
              </Link>
              <Link className="btn btn--accent btn--sm" to="/signup">
                Get started
              </Link>
            </>
          )}
          <button
            className="nav__toggle"
            aria-label="Toggle navigation"
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </div>
      {open && (
        <div className="container" style={{ paddingBottom: 16 }}>
          <nav className="stack" aria-label="Mobile">
            {LINKS.map((link) => (
              <Link key={link.label} to={link.to} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
