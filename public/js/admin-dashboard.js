console.log("Admin Dashboard JS Loaded");

// Toggle Sidebar
const toggleBtn = document.getElementById('toggleBtn');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');

toggleBtn.addEventListener('click', function () {
  sidebar.classList.toggle('hidden');
  mainContent.classList.toggle('expanded');
});

// Avatar Dropdown
const avatarBtn = document.getElementById('avatarBtn');
const avatarDropdown = document.getElementById('avatarDropdown');

avatarBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  avatarDropdown.classList.toggle('show');
});

document.addEventListener('click', function () {
  avatarDropdown.classList.remove('show');
});

// Logout buttons
document.getElementById('logoutBtn').addEventListener('click', function () {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/';
});

document.getElementById('dropdownLogout').addEventListener('click', function () {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/';
});

// Load dashboard counts
async function loadCounts() {
  try {
    const res = await fetch("/api/admin/dashboard-counts");
    const data = await res.json();

    document.getElementById("patientsCount").textContent = data.patients;
    document.getElementById("psychiatristsCount").textContent = data.psychiatrists;
    document.getElementById("appointmentsCount").textContent = data.appointments;
    document.getElementById("reviewsCount").textContent = data.reviews;

  } catch (err) {
    console.log("Could not load counts:", err);
  }
}

loadCounts();
