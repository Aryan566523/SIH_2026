import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    const url = originalRequest?.url || '';

    // Don't attempt refresh for auth endpoints themselves
    const isAuthEndpoint = url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/register');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);

          // Update cookie
          document.cookie = `cs_access_token=${data.accessToken}; path=/; max-age=${data.expiresIn || 900}; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;

          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        // Refresh failed - clear everything and redirect
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        document.cookie = 'cs_access_token=; path=/; max-age=0; SameSite=Lax';

        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.replace('/login');
        }
      }
    }

    return Promise.reject(error);
  },
);

// API functions
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) =>
    api.post('/auth/register', data),
  logout: () =>
    api.post('/auth/logout'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  me: () =>
    api.post('/auth/me'),
};

export const casesApi = {
  list: (params?: any) =>
    api.get('/cases', { params }),
  get: (id: string) =>
    api.get(`/cases/${id}`),
  create: (data: any) =>
    api.post('/cases', data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/cases/${id}/status`, { status }),
  getStats: () =>
    api.get('/cases/stats'),
  getComplaints: (id: string) =>
    api.get(`/cases/${id}/complaints`),
};

export const investigationsApi = {
  list: (params?: any) =>
    api.get('/investigations', { params }),
  get: (id: string) =>
    api.get(`/investigations/${id}`),
  create: (data: any) =>
    api.post('/investigations', data),
  getJobs: (id: string) =>
    api.get(`/investigations/${id}/jobs`),
  getStats: () =>
    api.get('/investigations/stats'),
};

export const walletsApi = {
  search: (q: string) =>
    api.get('/wallets/search', { params: { q } }),
  get: (address: string) =>
    api.get(`/wallets/${address}`),
  getTransactions: (address: string, params?: any) =>
    api.get(`/wallets/${address}/transactions`, { params }),
  getRisk: (address: string) =>
    api.get(`/wallets/${address}/risk`),
  getAttribution: (address: string) =>
    api.get(`/wallets/${address}/attribution`),
};

export const graphApi = {
  build: (address: string, blockchain: string, depth?: number) =>
    api.post('/graph/build', { address, blockchain, depth }),
  getCaseGraph: (caseId: string) =>
    api.get(`/graph/case/${caseId}`),
  traceForward: (address: string, blockchain: string, maxHops?: number) =>
    api.post('/graph/trace/forward', { address, blockchain, maxHops }),
  traceBackward: (address: string, blockchain: string, maxHops?: number) =>
    api.post('/graph/trace/backward', { address, blockchain, maxHops }),
};

export const alertsApi = {
  list: (params?: any) =>
    api.get('/alerts', { params }),
  getUnreadCount: () =>
    api.get('/alerts/unread-count'),
  markRead: (id: string) =>
    api.patch(`/alerts/${id}/read`),
  acknowledge: (id: string) =>
    api.patch(`/alerts/${id}/acknowledge`),
  getStats: () =>
    api.get('/alerts/stats'),
};

export const watchlistApi = {
  list: (params?: any) =>
    api.get('/watchlist', { params }),
  add: (data: any) =>
    api.post('/watchlist', data),
  remove: (id: string) =>
    api.delete(`/watchlist/${id}`),
};

export const vaspApi = {
  list: (params?: any) =>
    api.get('/vasp', { params }),
  get: (id: string) =>
    api.get(`/vasp/${id}`),
  findByWallet: (address: string) =>
    api.get(`/vasp/wallet/${address}`),
  getStats: () =>
    api.get('/vasp/stats'),
};

export const reportsApi = {
  generate: (caseId: string) =>
    api.post(`/reports/${caseId}/generate`),
  getByCase: (caseId: string) =>
    api.get(`/reports/case/${caseId}`),
  verify: (id: string) =>
    api.get(`/reports/${id}/verify`),
};

export const searchApi = {
  search: (q: string, type?: string) =>
    api.get('/search', { params: { q, type } }),
};

export const healthApi = {
  check: () =>
    api.get('/health/detailed'),
};

export const adminApi = {
  getUsers: () =>
    api.get('/admin/users'),
  updateRole: (id: string, role: string) =>
    api.patch(`/admin/users/${id}/role`, { role }),
  toggleActive: (id: string) =>
    api.patch(`/admin/users/${id}/toggle`),
  getOrganizations: () =>
    api.get('/admin/organizations'),
  getStats: () =>
    api.get('/admin/stats'),
};
