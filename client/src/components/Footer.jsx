import { Link } from 'react-router-dom';
import { BrandMark } from './Brand.jsx';

const COLUMNS = [
  {
    title: 'Company',
    links: ['Careers', 'Press & media', 'Enterprise', 'Security', 'Trust center', 'Partnerships'],
  },
  {
    title: 'Product',
    links: [
      'Pricing',
      'Student discount',
      'For work',
      'Small businesses',
      'Founders',
      'Product Managers',
      'Designers',
      'App builder',
      'Website builder',
      'AI-powered apps',
      'Prototyping',
      'Internal Tools',
      'Connections',
      'Changelog',
      'Status',
    ],
  },
  {
    title: 'Resources',
    links: ['Learn', 'Templates', 'Guides', 'Connectors', 'MCP server', 'Videos', 'Blog', 'Support', 'Reviews', 'Sitemap'],
  },
  {
    title: 'Legal',
    links: [
      'Privacy policy',
      'Cookie settings',
      'Enterprise terms',
      'General terms',
      'Domain registration terms',
      'DMCA copyright policy',
      'Accessibility',
      'Report abuse',
    ],
  },
  {
    title: 'Community',
    links: ['Become a partner', 'Hire a Lovable partner', 'Affiliates', 'Code of conduct', 'Discord', 'Reddit', 'X / Twitter', 'YouTube', 'LinkedIn'],
  },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__card">
        <div className="footer__grid">
          <div className="footer__brand">
            <Link to="/" aria-label="Home">
              <BrandMark size={34} />
            </Link>
            <button className="btn btn--ghost btn--sm" type="button" style={{ alignSelf: 'flex-start' }}>
              <span aria-hidden="true">🌐</span> EN
            </button>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((label) => (
                  <li key={label}>
                    <Link to="/">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} Lovable clone — an educational project.</span>
          <span className="row">
            <span>React</span>
            <span aria-hidden="true">·</span>
            <span>Express</span>
            <span aria-hidden="true">·</span>
            <span>SQLite</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
