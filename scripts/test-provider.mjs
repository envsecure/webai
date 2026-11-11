#!/usr/bin/env node
/**
 * Tests the real HTTP provider path (OpenAI wire format) against the local
 * fake provider server.
 *
 *   node scripts/fake-openai.mjs 3998 &
 *   node scripts/test-provider.mjs http://127.0.0.1:3998/v1 http://127.0.0.1:3001
 */
const PROVIDER_BASE = (process.argv[2] || 'http://127.0.0.1:3998/v1').replace(/\/$/, '');
const BASE = (process.argv[3] || 'http://127.0.0.1:3001').replace(/\/$/, '');

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
  return { status: res.status, json };
};

console.log(`\nProvider path test (${PROVIDER_BASE} -> ${BASE})\n`);

const signup = await call('/api/auth/signup', {
  method: 'POST',
  body: { email: `prov_${Date.now()}@example.com`, password: 'supersecret' },
});
if (signup.status !== 201) {
  bad(`signup failed: ${JSON.stringify(signup.json)}`);
  process.exit(1);
}
const token = signup.json.token;
ok('signed up');

const settings = await call('/api/settings', {
  method: 'PUT',
  token,
  body: {
    llm: {
      provider: 'compatible',
      baseUrl: PROVIDER_BASE,
      model: 'fake-model',
      apiKey: 'test-key',
      maxIterations: 10,
      reviewRounds: 1,
      subagents: true,
      contextTokens: 4000,
    },
  },
});
if (settings.status !== 200) {
  bad(`settings update failed: ${JSON.stringify(settings.json)}`);
  process.exit(1);
}
ok('settings saved (OpenAI-compatible provider)');

const test = await call('/api/settings/test-llm', { method: 'POST', token, body: {} });
if (test.status === 200 && test.json.ok) ok(`provider reachable: ${JSON.stringify(test.json)}`);
else bad(`provider test failed: ${JSON.stringify(test.json)}`);

const build = await call('/api/projects/quick-build', {
  method: 'POST',
  token,
  body: { prompt: 'Build a small products app' },
});
if (build.status !== 201) {
  bad(`quick-build failed: ${JSON.stringify(build.json)}`);
  process.exit(1);
}

const agent = build.json.agent || {};
const files = Object.keys(build.json.files || {});
if (files.length >= 3) ok(`agent wrote ${files.length} files over HTTP: ${files.join(', ')}`);
else bad(`agent wrote only ${files.length} files`);

if (agent.iterations >= 3) ok(`tool loop ran ${agent.iterations} iterations`);
else bad(`expected several iterations, got ${agent.iterations}`);

if ((agent.subagents || []).length) {
  ok(`subagent delegated over HTTP: ${agent.subagents.map((s) => s.id).join(', ')}`);
} else {
  bad('no delegation happened');
}

if (agent.llm?.provider === 'compatible') ok('provider recorded as "compatible"');
else bad(`unexpected provider: ${agent.llm?.provider}`);

if (build.json.plan?.length) ok(`model produced a ${build.json.plan.length}-step plan`);
else bad('no plan returned');

console.log(failures === 0 ? '\nAll provider checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
