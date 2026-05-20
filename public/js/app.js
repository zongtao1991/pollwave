const API_BASE = '/api';

const storage = {
  getToken: () => localStorage.getItem('pollwave_token'),
  setToken: (token) => localStorage.setItem('pollwave_token', token),
  removeToken: () => localStorage.removeItem('pollwave_token'),
  getUser: () => {
    const user = localStorage.getItem('pollwave_user');
    return user ? JSON.parse(user) : null;
  },
  setUser: (user) => localStorage.setItem('pollwave_user', JSON.stringify(user)),
  removeUser: () => localStorage.removeItem('pollwave_user'),
  clear: () => {
    storage.removeToken();
    storage.removeUser();
  }
};

const api = {
  async request(endpoint, options = {}) {
    const token = storage.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};

const auth = {
  async register(username, email, password) {
    const data = await api.post('/auth/register', { username, email, password });
    if (data.token) {
      storage.setToken(data.token);
      storage.setUser(data.user);
    }
    return data;
  },

  async login(username, password) {
    const data = await api.post('/auth/login', { username, password });
    if (data.token) {
      storage.setToken(data.token);
      storage.setUser(data.user);
    }
    return data;
  },

  logout() {
    storage.clear();
    window.location.href = '/';
  },

  isAuthenticated() {
    return !!storage.getToken();
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/';
    }
  },

  getUser() {
    return storage.getUser();
  },
};

const ui = {
  showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('active'), 10);

    setTimeout(() => {
      toast.classList.remove('active');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  showError(message) {
    this.showToast(message, 'error');
  },

  showSuccess(message) {
    this.showToast(message, 'success');
  },

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  getStatusBadge(status) {
    const statusMap = {
      draft: { text: '草稿', class: 'status-draft' },
      active: { text: '进行中', class: 'status-active' },
      closed: { text: '已关闭', class: 'status-closed' },
    };
    const info = statusMap[status] || statusMap.draft;
    return `<span class="status-badge ${info.class}">${info.text}</span>`;
  },

  updateNav() {
    const user = auth.getUser();
    const navLinks = document.getElementById('nav-links');
    const loginNav = document.getElementById('login-nav');
    const userNav = document.getElementById('user-nav');
    const userName = document.getElementById('user-name');

    if (auth.isAuthenticated() && user) {
      if (navLinks) navLinks.style.display = 'flex';
      if (loginNav) loginNav.style.display = 'none';
      if (userNav) userNav.style.display = 'flex';
      if (userName) userName.textContent = user.username;
    } else {
      if (navLinks) navLinks.style.display = 'none';
      if (loginNav) loginNav.style.display = 'flex';
      if (userNav) userNav.style.display = 'none';
    }
  },
};

function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function getShareCodeFromPath() {
  const path = window.location.pathname;
  const match = path.match(/^\/share\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function getPollIdFromPath() {
  const path = window.location.pathname;
  const match = path.match(/^\/polls\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}
