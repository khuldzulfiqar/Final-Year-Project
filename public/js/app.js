const Auth = {
  getToken: () => localStorage.getItem('mb_token'),
  getUser: () => { const u = localStorage.getItem('mb_user'); return u ? JSON.parse(u) : null; },
  setAuth: (token, user) => { localStorage.setItem('mb_token', token); localStorage.setItem('mb_user', JSON.stringify(user)); },
  clear: () => { localStorage.removeItem('mb_token'); localStorage.removeItem('mb_user'); },
  isLoggedIn: () => !!localStorage.getItem('mb_token'),
  isPsychiatrist: () => { const u = Auth.getUser(); return u && u.role === 'psychiatrist'; },
  isPatient: () => { const u = Auth.getUser(); return u && u.role === 'patient'; },
  isAdmin: () => { const u = Auth.getUser(); return u && u.role === 'admin'; }
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
  const isAdmin = Auth.isAdmin();
  const currentPath = window.location.pathname;

  // Helper to mark active link
  const link = (href, label) => {
    const active = currentPath === href || (href !== '/' && currentPath.startsWith(href)) ? ' active' : '';
    return `<a href="${href}" class="nav-link${active}">${label}</a>`;
  };

  let html = '';
  html += link('/', 'Home');
  html += link('/psychiatrists', 'View Psychiatrists');
  html += link('/about', 'About Us');

  if (!isLoggedIn) {
    html += link('/dashboard', 'My Dashboard');
    html += `<a href="/login" class="btn-nav btn-nav-outline">Login</a>`;
    html += `<a href="/register" class="btn-nav btn-nav-primary">Register</a>`;
  } else if (isAdmin) {
    html += `<a href="/admin/admin-dashboard.html" class="nav-link">My Dashboard</a>`;
    html += `<button onclick="logout()" class="btn-nav btn-nav-danger">Logout</button>`;
  } else {

    html += link('/dashboard', 'My Dashboard');

    const user = Auth.getUser();
    const name = user?.fullName || 'User';
    const email = user?.email || 'user@email.com';
    const role = user?.role;

    const initial = name.charAt(0).toUpperCase();

    const profileLink =
      role === "psychiatrist"
        ? "/psy-profile"
        : "/patient-profile";

    html += `
<div class="account-container">

  <div class="avatar-btn" onclick="toggleDropdown()">
    ${initial}
  </div>

  <div class="dropdown profile-dropdown" id="accountDropdown">
    
    <div class="dropdown-header">
      <div class="avatar-large">${initial}</div>
      <div class="user-info">
        <div class="user-name">${name}</div>
        <div class="user-email">${email}</div>
      </div>
    </div>

    <div class="dropdown-divider"></div>

    <a href="${profileLink}">👤 Profile</a>
    <a href="#" onclick="logout()">🚪 Logout</a>

  </div>

</div>
`;
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
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}

document.addEventListener('DOMContentLoaded', () => { buildNavbar(); });
function toggleDropdown() {
  const menu = document.getElementById("accountDropdown");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

window.onclick = function (e) {
  if (!e.target.closest('.account-container')) {
    const menu = document.getElementById("accountDropdown");
    if (menu) menu.style.display = "none";
  }
}