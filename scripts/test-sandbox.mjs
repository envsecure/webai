#!/usr/bin/env node
/**
 * End-to-end check of the preview sandbox:
 *   build a project -> the sandbox boots -> the preview serves the app ->
 *   the generated API answers -> the client bundle is served by Vite.
 *
 *   node scripts/test-sandbox.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:3001').replace(/\/$/, '');

let failures = 0;
const ok = (m) => console.log(`  ✔ ${m}`);
const bad = (m) => {
  failures += 1;
  console.log(`  ✘ ${m}`);
};

const call = async (path, { method = 'GET', body, token } = {}) => {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
};

console.log(`\nSandbox test against ${BASE}\n`);

const signup = await call('/api/auth/signup', {
  method: 'POST',
  body: { email: `sandbox_${Date.now()}@example.com`, password: 'supersecret' },
});
if (signup.status !== 201) {
  bad(`signup failed: ${JSON.stringify(signup.json)}`);
  process.exit(1);
}
const token = signup.json.token;
ok('signed up');

// Configure the scripted provider so the build needs no external model.
await call('/api/settings', {
  method: 'PUT',
  token,
  body: { llm: { provider: 'mock', maxIterations: 12, reviewRounds: 1, subagents: true } },
});

const build = await call('/api/projects/quick-build', {
  method: 'POST',
  token,
  body: { prompt: 'Build a task manager with priorities and due dates' },
});
if (build.status !== 201) {
  bad(`build failed: ${JSON.stringify(build.json)}`);
  process.exit(1);
}
const projectId = build.json.project.id;
ok(`built the project: ${projectId}`);

// The sandbox starts in the background after the build.
let state = null;
for (let i = 0; i < 40; i += 1) {
  const res = await call(`/api/projects/${projectId}/sandbox`, { token });
  state = res.json?.sandbox;
  if (state?.status === 'running') break;
  await new Promise((r) => setTimeout(r, 500));
}

if (state?.status === 'running') {
  ok(`sandbox running (mode=${state.mode}, port=${state.port})`);
} else {
  bad(`sandbox did not start: ${JSON.stringify(state)}`);
}

// The preview page is served through the proxy.
const preview = await call(`/api/sandbox/${projectId}/`);
if (preview.status === 200 && preview.text.includes('<div id="root">')) {
  ok('the preview serves the generated app shell');
} else {
  bad(`preview failed (${preview.status}): ${preview.text.slice(0, 200)}`);
}

// Vite transforms the client entry point.
const entry = await call(`/api/sandbox/${projectId}/client/src/main.jsx`);
if (entry.status === 200 && entry.text.includes('createRoot')) {
  ok('vite transforms the client entry point');
} else {
  bad(`vite did not serve the entry point (${entry.status}): ${entry.text.slice(0, 200)}`);
}

// The generated API answers.
const api = await call(`/api/sandbox/${projectId}/api/tasks`);
if (api.status === 200 && Array.isArray(api.json)) {
  ok(`the generated API answers (${api.json.length} rows)`);
} else {
  bad(`the generated API failed (${api.status}): ${JSON.stringify(api.json).slice(0, 200)}`);
}

// Creating a row works and the database persists it.
const created = await call(`/api/sandbox/${projectId}/api/tasks`, {
  method: 'POST',
  body: { title: 'From the sandbox test' },
});
if (created.status === 201 && created.json?.title === 'From the sandbox test') {
  ok('the generated API creates rows');
} else {
  bad(`create failed (${created.status}): ${JSON.stringify(created.json).slice(0, 200)}`);
}

// The React component the generator produced imports the right path.
const component = await call(`/api/sandbox/${projectId}/client/src/components/TaskList.jsx`);
// Vite rewrites the import specifier, so match the path rather than the syntax.
if (component.status === 200 && component.text.includes('lib/api')) {
  ok('the generated component imports the api helper correctly');
} else {
  bad('the generated component has the wrong import path');
}

// Stopping works.
const stopped = await call(`/api/projects/${projectId}/sandbox/stop`, { method: 'POST', token });
if (stopped.json?.sandbox?.status === 'stopped') ok('the sandbox stops cleanly');
else bad(`stop failed: ${JSON.stringify(stopped.json)}`);

console.log(failures === 0 ? '\nAll sandbox checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
