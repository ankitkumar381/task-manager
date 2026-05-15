/**
 * Centralized API client
 * All fetch calls go through here so the base URL and auth header are consistent.
 */

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('ttm_token');
}

async function request(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

const api = {
  // Auth
  signup:  (body) => request('POST', '/auth/signup', body),
  login:   (body) => request('POST', '/auth/login', body),
  me:      ()     => request('GET',  '/auth/me'),

  // Dashboard
  dashboard: () => request('GET', '/dashboard'),

  // Projects
  getProjects:    ()           => request('GET',    '/projects'),
  createProject:  (body)       => request('POST',   '/projects', body),
  getProject:     (id)         => request('GET',    `/projects/${id}`),
  updateProject:  (id, body)   => request('PUT',    `/projects/${id}`, body),
  deleteProject:  (id)         => request('DELETE', `/projects/${id}`),
  addMember:      (id, body)   => request('POST',   `/projects/${id}/members`, body),
  removeMember:   (id, userId) => request('DELETE', `/projects/${id}/members/${userId}`),
  getMembers:     (id)         => request('GET',    `/projects/${id}/members`),

  // Tasks
  getTasks:    (projectId)         => request('GET',    `/projects/${projectId}/tasks`),
  createTask:  (projectId, body)   => request('POST',   `/projects/${projectId}/tasks`, body),
  updateTask:  (taskId, body)      => request('PUT',    `/tasks/${taskId}`, body),
  deleteTask:  (taskId)            => request('DELETE', `/tasks/${taskId}`),
};

window.api = api;
