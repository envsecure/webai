#!/usr/bin/env node
/**
 * Exercises the agent loop end-to-end against a running server:
 *   - tool loop, subagent delegation, review round, context compaction
 *   - the NDJSON streaming endpoint
 *
 *   node scripts/test-agent.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:3001').replace(/\/$/, '');
const EMAIL = `agent_${Date.now()}@example.com`;
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

console.log(`\nAgent loop test against ${BASE}\n`);

// --- signup ---------------------------------------------------------------
const signup = await call('/api/auth/signup', {
  method: 'POST',
  body: { email: EMAIL, password: 'supersecret', name: 'Agent Tester' },
});
if (signup.status !== 201) {
  bad(`signup failed: ${JSON.stringify(signup.json)}`);
  process.exit(1);
}
const token = signup.json.token;
ok('signed up');

// --- settings: force the mock provider + a tiny context window ------------
const settings = await call('/api/settings', {
  method: 'PUT',
  token,
  body: {
    llm: {
      provider: 'mock',
      maxIterations: 12,
      reviewRounds: 1,
      subagents: true,
      contextTokens: 900, // tiny, so compaction has to kick in
    },
  },
});
if (settings.status !== 200) bad(`settings update failed: ${JSON.stringify(settings.json)}`);
else ok('settings saved (mock provider, 900-token context window)');

const llmInfo = await call('/api/settings', { token });
console.log(
  `    provider=${llmInfo.json.llm?.provider} model=${llmInfo.json.llm?.model} ` +
    `contextTokens=${llmInfo.json.settings?.llm?.contextTokens}`
);

// --- quick build ----------------------------------------------------------
const build = await call('/api/projects/quick-build', {
  method: 'POST',
  token,
  body: { prompt: 'Build a task manager with priorities and due dates' },
});
if (build.status !== 201) {
  bad(`quick-build failed: ${JSON.stringify(build.json)}`);
  process.exit(1);
}
const agent = build.json.agent || {};
const files = Object.keys(build.json.files || {});
if (files.length >= 5) ok(`agent wrote ${files.length} files`);
else bad(`agent wrote only ${files.length} files`);

if (agent.iterations > 1) ok(`tool loop ran ${agent.iterations} iterations`);
else bad(`expected multiple iterations, got ${agent.iterations}`);

const subs = agent.subagents || [];
if (subs.length) ok(`subagents ran: ${subs.map((s) => `${s.id}(${s.iterations})`).join(', ')}`);
else bad('no subagent delegation happened');

if ((agent.reviews || []).length) ok('review round produced a report');
else bad('no review report');

if (agent.context?.compactions > 0) ok(`context compacted ${agent.context.compactions}x`);
else bad(`context never compacted (tokens ${agent.context?.tokens}/${agent.context?.budget})`);

// --- streaming endpoint ---------------------------------------------------
const projectId = build.json.project.id;
const streamRes = await fetch(`${BASE}/api/projects/${projectId}/chat/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ prompt: 'now add a dashboard view' }),
});
const raw = await streamRes.text();
const events = raw
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

if (events.length > 5) ok(`stream produced ${events.length} NDJSON events`);
else bad(`stream produced only ${events.length} events`);

const types = [...new Set(events.map((e) => e.type))];
const innerTypes = [
  ...new Set(
    events
      .filter((e) => e.type === 'agent_event')
      .map((e) => e.event?.type)
      .filter(Boolean)
  ),
];
ok(`event types: ${types.join(', ')}`);
ok(`agent events: ${innerTypes.join(', ')}`);

const hasResult = events.some((e) => e.type === 'result');
if (hasResult) ok('stream ended with a result event');
else bad('stream had no result event');

for (const expected of ['tool_call', 'subagent_start', 'subagent_end']) {
  if (innerTypes.includes(expected)) ok(`saw "${expected}"`);
  else bad(`missing "${expected}" event`);
}

// --- versions -------------------------------------------------------------
const versions = await call(`/api/projects/${projectId}/versions`, { token });
if ((versions.json.versions || []).length >= 2) {
  ok(`${versions.json.versions.length} versions recorded`);
} else {
  bad('expected at least 2 versions');
}

console.log(failures === 0 ? '\nAll agent checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
