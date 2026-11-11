#!/usr/bin/env node
/**
 * Full-app test.
 *
 * The agent builds a complete app, and then:
 *   - the plan is printed,
 *   - the generated frontend is checked against the generated backend: the
 *     path the client calls must be exactly the route the agent wrote,
 *   - that path is exercised for real: list, create, list again,
 *   - the preview serves the app.
 *
 *   node scripts/test-full-app.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:3001').replace(/\/$/, '');

let failures = 0;
const ok = (m) => console.log(`  ✔ ${m}`);
const bad = (m) => {
  failures += 1;
  console.log(`  ✘ ${m}`);
};
const head = (m) => console.log(`\n${m}`);

const call = async (path, { method = 'GET', body, token, raw = false } = {}) => {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text, raw };
};

console.log(`\nFull app test against ${BASE}\n`);

// --- setup -----------------------------------------------------------------
const signup = await call('/api/auth/signup', {
  method: 'POST',
  body: { email: `full_${Date.now()}@example.com`, password: 'supersecret' },
});
if (signup.status !== 201) {
  bad(`signup failed: ${signup.text}`);
  process.exit(1);
}
const token = signup.json.token;
ok('signed up');

await call('/api/settings', {
  method: 'PUT',
  token,
  body: { llm: { provider: 'mock', maxIterations: 12, reviewRounds: 1, subagents: true } },
});

// --- build -----------------------------------------------------------------
const PROMPT = 'Build a portfolio website for a designer with projects and a contact form';
const build = await call('/api/projects/quick-build', { method: 'POST', token, body: { prompt: PROMPT } });
if (build.status !== 201) {
  bad(`build failed: ${build.text}`);
  process.exit(1);
}
const projectId = build.json.project.id;
const files = build.json.files || {};

head('The plan the agent produced:');
for (const [i, step] of (build.json.plan || []).entries()) {
  console.log(`  ${i + 1}. ${step.step} — ${step.detail}`);
}
if ((build.json.plan || []).length >= 3) ok(`plan has ${build.json.plan.length} steps`);
else bad('the plan is too short');

// --- what was written ------------------------------------------------------
head('Files written:');
let lines = 0;
for (const [file, content] of Object.entries(files)) {
  const count = String(content).split('\n').length;
  lines += count;
  console.log(`  ${file.padEnd(42)} ${String(count).padStart(4)} lines`);
}
console.log(`  ${'total'.padEnd(42)} ${String(lines).padStart(4)} lines`);

if (Object.keys(files).length >= 8) ok(`${Object.keys(files).length} files generated`);
else bad(`only ${Object.keys(files).length} files generated`);
if (lines >= 80 && lines <= 400) ok(`the app is ${lines} lines - a small, complete app`);
else bad(`unexpected size: ${lines} lines`);

// --- the frontend must call the backend the agent wrote --------------------
head('Frontend -> backend contract:');
const clientFile = Object.keys(files).find((f) => f.endsWith('lib/api.js'));
const routeFiles = Object.keys(files).filter((f) => f.startsWith('server/src/routes/'));

if (!clientFile) bad('no client api module was generated');
if (routeFiles.length !== 1) bad(`expected one route file, found ${routeFiles.length}`);

const apiSource = files[clientFile] || '';
const baseMatch = apiSource.match(/const BASE = '([^']+)'/);
const routeTable = routeFiles[0]?.replace('server/src/routes/', '').replace(/\.js$/, '');

if (baseMatch) {
  console.log(`  client calls      : ${baseMatch[1]}`);
  console.log(`  agent wrote route : server/src/routes/${routeTable}.js`);
  if (baseMatch[1].endsWith(routeTable)) ok('the client calls exactly the route the agent wrote');
  else bad(`the client calls "${baseMatch[1]}" but the route is "${routeTable}"`);
} else {
  bad('could not find the API base in the generated client');
}

// The component must import the helper from the right place.
const componentFile = Object.keys(files).find((f) => f.includes('/components/'));
const componentSource = files[componentFile] || '';
if (/from '\.\.\/lib\/api'/.test(componentSource)) ok('the component imports the api helper correctly');
else bad('the component imports the api helper from the wrong path');

// --- the sandbox -----------------------------------------------------------
let sandbox = null;
for (let i = 0; i < 40; i += 1) {
  const res = await call(`/api/projects/${projectId}/sandbox`, { token });
  sandbox = res.json?.sandbox;
  if (sandbox?.status === 'running') break;
  await new Promise((r) => setTimeout(r, 500));
}
if (sandbox?.status === 'running') ok(`sandbox running (${sandbox.mode})`);
else bad(`sandbox did not start: ${JSON.stringify(sandbox)}`);

const sandboxBase = `/api/sandbox/${projectId}`;
const clientPath = baseMatch ? `${sandboxBase}/${baseMatch[1]}` : `${sandboxBase}/api/${routeTable}`;

// The preview page.
const preview = await call(`${sandboxBase}/`);
if (preview.status === 200 && preview.text.includes('<div id="root">')) ok('the preview serves the app shell');
else bad(`the preview did not serve the app (${preview.status})`);

// --- exercise the exact path the frontend calls ---------------------------
head('Calling the exact path the frontend uses:');
const list = await call(clientPath);
if (list.status === 200 && Array.isArray(list.json)) ok(`GET ${baseMatch?.[1]} -> ${list.json.length} rows`);
else bad(`GET ${baseMatch?.[1]} -> ${list.status} ${list.text.slice(0, 120)}`);

const labelField = list.json?.[0] ? Object.keys(list.json[0]).find((k) => k !== 'id' && k !== 'created_at' && k !== 'updated_at') : 'title';
const created = await call(clientPath, {
  method: 'POST',
  body: { [labelField]: 'Created through the contract test' },
});
if (created.status === 201 && created.json) ok(`POST ${baseMatch?.[1]} -> created row ${created.json.id}`);
else bad(`POST ${baseMatch?.[1]} -> ${created.status} ${created.text.slice(0, 160)}`);

const after = await call(clientPath);
const found = Array.isArray(after.json) && after.json.some((row) => row.id === created.json?.id);
if (found) ok('the new row is returned by the same path');
else bad('the new row did not come back');

// The unauthenticated path must not leak the project data.
const direct = await call(`/api/projects/${projectId}/messages`);
if (direct.status === 401) ok('the app API still requires a token');
else bad(`the app API answered ${direct.status} without a token`);

console.log(failures === 0 ? '\nThe full app works end to end.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
