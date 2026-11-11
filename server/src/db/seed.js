import { initDatabase, db } from './index.js';
import { upsertCommunityProject, upsertTemplate } from '../repositories/catalog.js';
import { hashPassword, id, nowIso } from '../lib/util.js';
import { createProject, createChat, createMessage } from '../repositories/projects.js';

const TEMPLATES = [
  {
    id: 'tpl_ecommerce',
    name: 'Online store',
    description: 'Full storefront with products, cart, checkout and order tracking.',
    category: 'commerce',
    stack: 'react,express,sqlite',
    prompt: 'Build an online store with a product catalog, shopping cart and checkout',
    tags: 'ecommerce,shop,payments',
    installs: 12480,
    rating: 4.9,
    creator: 'lovable',
    verified: 1,
  },
  {
    id: 'tpl_saas_dashboard',
    name: 'SaaS dashboard',
    description: 'Admin panel with metrics, charts, tables and role-based views.',
    category: 'dashboard',
    stack: 'react,express,sqlite',
    prompt: 'Create an analytics dashboard with charts, filters and a data table',
    tags: 'dashboard,analytics,admin',
    installs: 9310,
    rating: 4.8,
    creator: 'lovable',
    verified: 1,
  },
  {
    id: 'tpl_blog',
    name: 'Blog & CMS',
    description: 'Publishing platform with posts, authors, tags and SEO metadata.',
    category: 'content',
    stack: 'react,express,sqlite',
    prompt: 'Build a blog with posts, comments and an editor',
    tags: 'blog,cms,content',
    installs: 8760,
    rating: 4.7,
    creator: 'lovable',
    verified: 1,
  },
  {
    id: 'tpl_task_manager',
    name: 'Task manager',
    description: 'Kanban board with priorities, due dates and team assignment.',
    category: 'productivity',
    stack: 'react,express,sqlite',
    prompt: 'Build a task manager with a kanban board, priorities and due dates',
    tags: 'todo,kanban,productivity',
    installs: 15220,
    rating: 4.9,
    creator: 'lovable',
    verified: 1,
  },
  {
    id: 'tpl_chat',
    name: 'Chat app',
    description: 'Realtime-style messaging with conversations, presence and read receipts.',
    category: 'social',
    stack: 'react,express,sqlite',
    prompt: 'Build a chat app with conversations and message threads',
    tags: 'chat,messaging,social',
    installs: 7440,
    rating: 4.6,
    creator: 'community',
    verified: 0,
  },
  {
    id: 'tpl_crm',
    name: 'CRM pipeline',
    description: 'Lead tracking with pipeline stages, contacts and activity history.',
    category: 'business',
    stack: 'react,express,sqlite',
    prompt: 'Create a CRM to track customers, leads and deals through a pipeline',
    tags: 'crm,sales,business',
    installs: 6180,
    rating: 4.7,
    creator: 'community',
    verified: 0,
  },
  {
    id: 'tpl_booking',
    name: 'Booking platform',
    description: 'Availability calendar, reservations, reminders and payments hooks.',
    category: 'business',
    stack: 'react,express,sqlite',
    prompt: 'Build a booking platform with a calendar and reservations',
    tags: 'booking,calendar,schedule',
    installs: 5210,
    rating: 4.5,
    creator: 'community',
    verified: 0,
  },
  {
    id: 'tpl_portfolio',
    name: 'Portfolio',
    description: 'Personal site with projects, case studies and a contact form.',
    category: 'marketing',
    stack: 'react,express,sqlite',
    prompt: 'Build a portfolio website for a designer with project case studies',
    tags: 'portfolio,personal,marketing',
    installs: 11030,
    rating: 4.8,
    creator: 'lovable',
    verified: 1,
  },
  {
    id: 'tpl_marketplace',
    name: 'Marketplace',
    description: 'Listings, search, filters, bookings and reviews.',
    category: 'commerce',
    stack: 'react,express,sqlite',
    prompt: 'Build a marketplace with listings, search and reviews',
    tags: 'marketplace,listings,search',
    installs: 4890,
    rating: 4.4,
    creator: 'community',
    verified: 0,
  },
  {
    id: 'tpl_landing',
    name: 'Landing page',
    description: 'Marketing site with hero, features, pricing and a signup form.',
    category: 'marketing',
    stack: 'react,express,sqlite',
    prompt: 'Build a landing page for a new product with a pricing section',
    tags: 'landing,marketing,saas',
    installs: 13840,
    rating: 4.9,
    creator: 'lovable',
    verified: 1,
  },
];

const COMMUNITY = [
  {
    id: 'cmp_1',
    title: 'Northwind Analytics',
    description: 'Real-time revenue dashboard for subscription businesses.',
    author: 'amelander',
    authorAvatar: 'https://i.pravatar.cc/80?img=12',
    likes: 2431,
    tags: 'dashboard,saas',
    stack: 'react,express,sqlite',
    demoUrl: 'https://example.com/northwind',
  },
  {
    id: 'cmp_2',
    title: 'Klar Study',
    description: 'Learning platform that turns notes into revision quizzes.',
    author: 'klar',
    authorAvatar: 'https://i.pravatar.cc/80?img=32',
    likes: 1877,
    tags: 'education,ai',
    stack: 'react,express,sqlite',
    demoUrl: 'https://example.com/klar',
  },
  {
    id: 'cmp_3',
    title: 'Scion Ops',
    description: 'Internal tool suite for field operations teams.',
    author: 'scion',
    authorAvatar: 'https://i.pravatar.cc/80?img=45',
    likes: 1512,
    tags: 'internal-tools,operations',
    stack: 'react,express,sqlite',
    demoUrl: 'https://example.com/scion',
  },
  {
    id: 'cmp_4',
    title: 'Nursa Care',
    description: 'Patient booking and intake for a healthcare provider.',
    author: 'nursa',
    authorAvatar: 'https://i.pravatar.cc/80?img=26',
    likes: 1204,
    tags: 'healthcare,booking',
    stack: 'react,express,sqlite',
    demoUrl: 'https://example.com/nursa',
  },
  {
    id: 'cmp_5',
    title: 'Storefront Kit',
    description: 'Conversion-focused storefront template with subscriptions.',
    author: 'lovable',
    authorAvatar: 'https://i.pravatar.cc/80?img=5',
    likes: 983,
    tags: 'ecommerce,storefront',
    stack: 'react,express,sqlite',
    demoUrl: 'https://example.com/storefront',
  },
];

async function seedDemoUser() {
  const email = 'demo@lovable.dev';
  const existing = await db().get('SELECT * FROM users WHERE email = ?', [email]);
  if (existing) return existing;

  const user = {
    id: id('usr'),
    email,
    name: 'Demo User',
    passwordHash: hashPassword('demo1234'),
    plan: 'free',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db().run(
    `INSERT INTO users (id, email, name, password_hash, plan, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.email, user.name, user.passwordHash, user.plan, user.createdAt, user.updatedAt]
  );
  await db().run(
    'INSERT INTO settings (user_id, theme, editor_theme, autoplay, updated_at) VALUES (?, ?, ?, ?, ?)',
    [user.id, 'dark', 'dark', 1, nowIso()]
  );

  const project = await createProject(user.id, {
    name: 'Habit tracker',
    description: 'A small app to track daily habits and streaks.',
    prompt: 'Build a habit tracker with daily check-ins and streaks',
    status: 'ready',
  });
  const chat = await createChat(user.id, project.id, 'Build chat');
  await createMessage(user.id, chat.id, project.id, {
    role: 'user',
    content: 'Build a habit tracker with daily check-ins and streaks',
  });
  await createMessage(user.id, chat.id, project.id, {
    role: 'assistant',
    content:
      'Built Habit tracker — a Starter app with a React UI, an Express API and a SQLite schema (items table).',
    meta: { appType: 'starter' },
  });

  return user;
}

async function main() {
  await initDatabase({ silent: true });

  for (const template of TEMPLATES) {
    await upsertTemplate({ ...template, createdAt: nowIso() });
  }
  for (const project of COMMUNITY) {
    await upsertCommunityProject({ ...project, createdAt: nowIso() });
  }

  const user = await seedDemoUser();

  const counts = {
    templates: (await db().get('SELECT COUNT(*) AS c FROM templates'))?.c,
    community: (await db().get('SELECT COUNT(*) AS c FROM community_projects'))?.c,
    users: (await db().get('SELECT COUNT(*) AS c FROM users'))?.c,
    projects: (await db().get('SELECT COUNT(*) AS c FROM projects'))?.c,
  };

  console.log('[seed] done', counts);
  console.log(`[seed] demo login -> ${user.email} / demo1234`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
