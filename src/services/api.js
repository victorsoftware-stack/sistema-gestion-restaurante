const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'sigr_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status} en la solicitud.`);
  }
  return data;
}

export const authApi = {
  login: (credentials) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  register: (payload) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => apiRequest('/auth/me'),
};

export const menuApi = {
  listCategories: (includeInactive = false) =>
    apiRequest(`/categories${includeInactive ? '?includeInactive=true' : ''}`),
  createCategory: (payload) =>
    apiRequest('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listDishes: (params = {}) => {
    const query = new URLSearchParams();
    if (params.categoryId) query.set('categoryId', params.categoryId);
    if (params.search) query.set('search', params.search);
    if (params.available !== undefined && params.available !== '') {
      query.set('available', String(params.available));
    }
    const qs = query.toString();
    return apiRequest(`/dishes${qs ? `?${qs}` : ''}`);
  },
  createDish: (payload) =>
    apiRequest('/dishes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateDish: (id, payload) =>
    apiRequest(`/dishes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  toggleAvailability: (id, available) =>
    apiRequest(`/dishes/${id}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ available }),
    }),
  deleteDish: (id) =>
    apiRequest(`/dishes/${id}`, {
      method: 'DELETE',
    }),
};

export const tablesApi = {
  list: () => apiRequest('/tables'),
};

export const ordersApi = {
  listLive: () => apiRequest('/orders/live'),
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.activeOnly) query.set('activeOnly', 'true');
    const qs = query.toString();
    return apiRequest(`/orders${qs ? `?${qs}` : ''}`);
  },
  create: (payload) =>
    apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStatus: (id, status) =>
    apiRequest(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const reservationsApi = {
  checkAvailability: ({ date, time, party_size }) => {
    const query = new URLSearchParams({ date });
    if (time) query.set('time', time);
    if (party_size) query.set('party_size', String(party_size));
    return apiRequest(`/reservations/availability?${query.toString()}`);
  },
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return apiRequest(`/reservations${qs ? `?${qs}` : ''}`);
  },
  create: (payload) =>
    apiRequest('/reservations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStatus: (id, status) =>
    apiRequest(`/reservations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const billingApi = {
  listInvoices: (date) => apiRequest(`/invoices${date ? `?date=${date}` : ''}`),
  getInvoice: (id) => apiRequest(`/invoices/${id}`),
  createInvoice: (payload) =>
    apiRequest('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  previewClosing: (date) =>
    apiRequest(`/cash-closing/preview${date ? `?date=${date}` : ''}`),
  listClosings: () => apiRequest('/cash-closing'),
  createClosing: (payload) =>
    apiRequest('/cash-closing', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getDailyReport: (date) =>
    apiRequest(`/reports/daily${date ? `?date=${date}` : ''}`),
};
