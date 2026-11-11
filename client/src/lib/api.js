const TOKEN_KEY = 'webai.token';
const USER_KEY = 'webai.user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (res.status === 204) return null;

  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    throw new ApiError(payload?.message || `Request failed (${res.status})`, res.status, payload);
  }
  return payload;
}

export const api = {
  // auth
  signup: (data) => request('/auth/signup', { method: 'POST', body: data, auth: false }),
  login: (data) => request('/auth/login', { method: 'POST', body: data, auth: false }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateMe: (data) => request('/auth/me', { method: 'PATCH', body: data }),

  // projects
  listProjects: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/projects${qs ? `?${qs}` : ''}`);
  },
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: data }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PATCH', body: data }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  quickBuild: (prompt) => request('/projects/quick-build', { method: 'POST', body: { prompt } }),
  chat: (id, body) => request(`/projects/${id}/chat`, { method: 'POST', body }),
  projectMessages: (id) => request(`/projects/${id}/messages`),
  versions: (id) => request(`/projects/${id}/versions`),

  // catalog
  templates: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/templates${qs ? `?${qs}` : ''}`, { auth: false });
  },
  installTemplate: (id) => request(`/templates/${id}/install`, { method: 'POST', auth: false }),
  community: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/community${qs ? `?${qs}` : ''}`, { auth: false });
  },
  likeProject: (id) => request(`/community/${id}/like`, { method: 'POST', auth: false }),

  // sandbox / preview
  sandboxStatus: (id) => request(`/projects/${id}/sandbox`),
  startSandbox: (id) => request(`/projects/${id}/sandbox/start`, { method: 'POST', body: {} }),
  restartSandbox: (id) => request(`/projects/${id}/sandbox/restart`, { method: 'POST', body: {} }),
  stopSandbox: (id) => request(`/projects/${id}/sandbox/stop`, { method: 'POST', body: {} }),

  // settings
  settings: () => request('/settings'),
  saveSettings: (data) => request('/settings', { method: 'PUT', body: data }),
  testLlm: () => request('/settings/test-llm', { method: 'POST', body: {} }),
  apiKeys: () => request('/api-keys'),
  createApiKey: (label) => request('/api-keys', { method: 'POST', body: { label } }),
  deleteApiKey: (id) => request(`/api-keys/${id}`, { method: 'DELETE' }),

  stats: () => request('/stats', { auth: false }),
  llmStatus: () => request('/llm/status', { auth: false }),
  detectModel: (payload) => request('/settings/detect-model', { method: 'POST', body: payload }),
  listModels: (payload) => request('/settings/list-models', { method: 'POST', body: payload }),
};

export default api;
