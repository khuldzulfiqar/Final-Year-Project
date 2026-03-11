const Auth = {
  getToken: () => localStorage.getItem('mb_token'),
  getUser: () => { const u = localStorage.getItem('mb_user'); return u ? JSON.parse(u) : null; },
  setAuth: (token, user) => { localStorage.setItem('mb_token', token); localStorage.setItem('mb_user', JSON.stringify(user)); },
  clear: () => { localStorage.removeItem('mb_token'); localStorage.removeItem('mb_user'); },
  isLoggedIn: () => !!localStorage.getItem('mb_token'),
  isPsychiatrist: () => { const u = Auth.getUser(); return u && u.role === 'psychiatrist'; },
  isPatient: () => { const u = Auth.getUser(); return u && u.role === 'patient'; }
};

function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function buildNavbar() {
  const nav = document.getElementById('dynamic-nav');
  if (!nav) return;
  const isLoggedIn = Auth.isLoggedIn();
  const isPsy = Auth.isPsychiatrist();
  let html = '';
  html += `<a href="/" class="nav-link">Home</a>`;
  html += `<a href="/psychiatrists" class="nav-link">View Psychiatrists</a>`;
  html += `<a href="/about" class="nav-link">About Us</a>`;
  if (!isLoggedIn) {
    html += `<a href="/login" class="btn-nav btn-nav-outline">Login</a>`;
    html += `<a href="/register" class="btn-nav btn-nav-primary">Register</a>`;
  } else if (isPsy) {
    html += `<a href="/create-profile" class="btn-nav btn-nav-outline">Create Profile</a>`;
    html += `<a href="/appointments" class="btn-nav btn-nav-outline">Appointments</a>`;
    html += `<a href="/reviews" class="btn-nav btn-nav-primary">Reviews</a>`;
    html += `<button onclick="logout()" class="btn-nav btn-nav-danger">Logout</button>`;
  } else {
    html += `<a href="/dashboard" class="btn-nav btn-nav-outline">My Dashboard</a>`;
    html += `<button onclick="logout()" class="btn-nav btn-nav-danger">Logout</button>`;
  }
  nav.innerHTML = html;
}

function logout() {
  Auth.clear();
  showToast('Logged out successfully', 'success');
  setTimeout(() => window.location.href = '/', 800);
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const token = Auth.getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(endpoint, opts);
  return res.json();
}

function showAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert-box alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}

document.addEventListener('DOMContentLoaded', () => { buildNavbar(); });
