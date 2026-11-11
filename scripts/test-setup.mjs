#!/usr/bin/env node
/**
 * Tests the "connect a model" flow:
 *   1. building without a model fails with a clear, actionable error
 *   2. Detect works out the models, context window and tool support
 *   3. after saving the connection, building works
 *
 *   node scripts/fake-openai.mjs 3998 &
 *   node scripts/test-setup.mjs http://127.0.0.1:3998/v1 http://127.0.0.1:3001
 */
// One argument = the app under test. Two = provider endpoint, then app.
const [arg1, arg2] = process.argv.slice(2);
const PROVIDER_BASE = (arg2 ? arg1 : 'http://127.0.0.1:3998/v1').replace(/\/$/, '');
const BASE = (arg2 ? arg2 : arg1 || 'http://127.0.0.1:3001').replace(/\/$/, '');

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

console.log(`\nModel setup test (${PROVIDER_BASE} -> ${BASE})\n`);

// --- signup ---------------------------------------------------------------
const signup = await call('/api/auth/signup', {
  method: 'POST',
  body: { email: `setup_${Date.now()}@example.com`, password: 'supersecret' },
});
if (signup.status !== 201) {
  bad(`signup failed: ${JSON.stringify(signup.json)}`);
  process.exit(1);
}
const token = signup.json.token;
ok('signed up');

// --- 1. building without a model -----------------------------------------
const noModel = await call('/api/projects/quick-build', {
  method: 'POST',
  token,
  body: { prompt: 'Build a small products app' },
});
if (noModel.status === 409 && noModel.json.error === 'no_model_configured') {
  ok('building without a model returns 409 no_model_configured');
} else {
  bad(`expected 409 no_model_configured, got ${noModel.status} ${JSON.stringify(noModel.json)}`);
}
if (/settings/i.test(noModel.json?.message || '')) {
  ok('the error message points at the settings page');
} else {
  bad(`the error message is not actionable: ${noModel.json?.message}`);
}

// --- 2. detect ------------------------------------------------------------
const detect = await call('/api/settings/detect-model', {
  method: 'POST',
  token,
  body: { provider: 'compatible', baseUrl: PROVIDER_BASE, apiKey: 'test-key' },
});
if (detect.status === 200) {
  ok(`detect answered: ${detect.json.models?.length} model(s)`);
  if (detect.json.models?.length >= 3) ok('model catalogue listed');
  else bad('no model catalogue');
  if (detect.json.contextTokens) ok(`context window detected: ${detect.json.contextTokens} tokens`);
  else bad('no context window detected');
  if (detect.json.supportsTools === true) ok('tool calling detected');
  else bad(`tool calling not detected: ${detect.json.messages?.join(' ')}`);
} else {
  bad(`detect failed: ${JSON.stringify(detect.json)}`);
}

// --- 3. save the connection and build -------------------------------------
const save = await call('/api/settings', {
  method: 'PUT',
  token,
  body: {
    llm: {
      provider: 'compatible',
      baseUrl: PROVIDER_BASE,
      model: detect.json.model || 'fake-model',
      apiKey: 'test-key',
      contextTokens: detect.json.contextTokens || 32000,
      maxIterations: 10,
      reviewRounds: 1,
      subagents: true,
    },
  },
});
if (save.status === 200 && save.json.llm?.configured) {
  ok(`connection saved: ${save.json.llm.provider} · ${save.json.llm.model}`);
} else {
  bad(`save failed: ${JSON.stringify(save.json)}`);
}

const settings = await call('/api/settings', { token });
if (settings.json.needsSetup === false) ok('the server no longer asks for setup');
else bad('the server still reports needsSetup');

const build = await call('/api/projects/quick-build', {
  method: 'POST',
  token,
  body: { prompt: 'Build a small products app' },
});
if (build.status === 201) {
  ok(`build succeeded after connecting: ${Object.keys(build.json.files || {}).length} files`);
} else {
  bad(`build failed: ${JSON.stringify(build.json)}`);
}

// --- 4. the public status endpoint ----------------------------------------
const status = await call('/api/llm/status');
if (status.status === 200 && typeof status.json.serverConfigured === 'boolean') {
  ok(`public status endpoint works (serverConfigured=${status.json.serverConfigured})`);
} else {
  bad(`public status endpoint broken: ${JSON.stringify(status.json)}`);
}

console.log(failures === 0 ? '\nAll setup checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
