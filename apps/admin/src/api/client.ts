import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.traceops.isaii.in/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem('refreshToken');
      if (refresh && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh-token`, {
            refreshToken: refresh,
          });
          localStorage.setItem('accessToken', data.data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (payload: { email: string; password: string; fullName: string; role?: string }) =>
    api.post('/auth/register', payload),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const projectsApi = {
  list: () => api.get('/projects'),
  overview: () => api.get('/projects/overview'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (payload: Record<string, unknown>) => api.post('/projects', payload),
  update: (id: string, payload: unknown) => api.patch(`/projects/${id}`, payload),
  createApiKey: (id: string, name: string) =>
    api.post(`/projects/${id}/api-keys`, { name }),
  addMember: (id: string, payload: { userId?: string; email?: string; role: string }) =>
    api.post(`/projects/${id}/members`, payload),
  updateMember: (id: string, userId: string, role: string) =>
    api.patch(`/projects/${id}/members/${userId}`, { role }),
  removeMember: (id: string, userId: string) =>
    api.delete(`/projects/${id}/members/${userId}`),
  memberCandidates: (id: string, search?: string) =>
    api.get(`/projects/${id}/member-candidates`, { params: search ? { search } : undefined }),
  analytics: (id: string) => api.get(`/projects/${id}/analytics`),
  dashboard: (id: string) => api.get(`/projects/${id}/analytics/dashboard`),
  listTickets: (id: string, params?: Record<string, string>) =>
    api.get(`/projects/${id}/tickets`, { params }),
  getTicket: (projectId: string, ticketId: string) =>
    api.get(`/projects/${projectId}/tickets/${ticketId}`),
  createTicket: (id: string, payload: unknown) =>
    api.post(`/projects/${id}/tickets`, payload),
  updateTicket: (projectId: string, ticketId: string, payload: unknown) =>
    api.patch(`/projects/${projectId}/tickets/${ticketId}`, payload),
  addComment: (projectId: string, ticketId: string, content: string) =>
    api.post(`/projects/${projectId}/tickets/${ticketId}/comments`, { content }),
  addAttachment: (
    projectId: string,
    ticketId: string,
    payload: { filename: string; dataUrl: string }
  ) => api.post(`/projects/${projectId}/tickets/${ticketId}/attachments`, payload),
  listMaintenance: (id: string) => api.get(`/projects/${id}/maintenance`),
  createMaintenance: (id: string, payload: unknown) =>
    api.post(`/projects/${id}/maintenance`, payload),
  updateMaintenance: (projectId: string, maintenanceId: string, payload: unknown) =>
    api.patch(`/projects/${projectId}/maintenance/${maintenanceId}`, payload),
  revealClientAdminPassword: (id: string) =>
    api.get(`/projects/${id}/client-admin-password`),
  listVersions: (id: string) => api.get(`/projects/${id}/versions`),
  listGitCommits: (id: string, limit = 20) =>
    api.get(`/projects/${id}/git/commits`, { params: { limit } }),
  syncGitVersions: (
    id: string,
    payload?: { includeCommits?: boolean; includeTags?: boolean; limit?: number }
  ) => api.post(`/projects/${id}/versions/sync-git`, payload || {}),
  createVersionFromCommit: (
    id: string,
    payload: {
      commitRef?: string;
      version?: string;
      createGitTag?: boolean;
      tagName?: string;
      status?: string;
      changelog?: string;
    }
  ) => api.post(`/projects/${id}/versions/from-commit`, payload),
  createVersion: (id: string, payload: Record<string, unknown>) =>
    api.post(`/projects/${id}/versions`, payload),
};

export const errorsApi = {
  list: (params: Record<string, string | number | boolean | undefined>) =>
    api.get('/errors', { params }),
  get: (id: string) => api.get(`/errors/${id}`),
  update: (id: string, payload: unknown) => api.patch(`/errors/${id}`, payload),
  similar: (id: string) => api.get(`/errors/${id}/similar`),
};

export const usersApi = {
  directory: (params?: { search?: string; status?: string }) =>
    api.get('/users/directory', { params }),
  list: (params?: Record<string, string | number | undefined>) =>
    api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (payload: {
    email: string;
    password: string;
    fullName: string;
    role?: string;
    username?: string;
    status?: string;
  }) => api.post('/users', payload),
  update: (
    id: string,
    payload: {
      fullName?: string;
      username?: string;
      role?: string;
      status?: string;
      emailVerified?: boolean;
    }
  ) => api.patch(`/users/${id}`, payload),
  resetPassword: (id: string, password: string) =>
    api.post(`/users/${id}/reset-password`, { password }),
  remove: (id: string, hard = false) =>
    api.delete(`/users/${id}`, { params: { hard: hard ? 'true' : undefined } }),
  bulkStatus: (userIds: string[], status: string) =>
    api.post('/users/bulk/status', { userIds, status }),
};
