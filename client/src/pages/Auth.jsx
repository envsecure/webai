import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

export default function Auth({ mode = 'login' }) {
  const isLogin = mode === 'login';
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup({ email, password, name });
      }
      const target = location.state?.from || location.state?.prompt;
      if (target && typeof target === 'string' && target.startsWith('/')) {
        navigate(target);
      } else if (location.state?.prompt) {
        navigate('/app');
      } else {
        navigate('/app');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth">
      <div className="auth__card">
        <h1 className="auth__title">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
          {isLogin
            ? 'Log in to keep building your projects.'
            : 'Start building full-stack apps in minutes. Free forever for small projects.'}
        </p>

        <form className="auth__form" onSubmit={onSubmit}>
          {!isLogin && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                autoComplete="name"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className="alert alert--error">{error}</div>}

          <button className="btn btn--accent btn--block btn--lg" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="auth__switch">
          {isLogin ? (
            <>
              New here? <Link to="/signup">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/login">Log in</Link>
            </>
          )}
        </p>

        {!isLogin && (
          <div className="alert" style={{ marginTop: 16, fontSize: 13 }}>
            Demo account: <strong>demo@lovable.dev</strong> / <strong>demo1234</strong>
          </div>
        )}
      </div>
    </section>
  );
}
