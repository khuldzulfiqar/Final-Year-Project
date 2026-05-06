// =====================
// SIDEBAR TOGGLE
// =====================
const toggleBtn = document.getElementById('toggleBtn');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');

toggleBtn.addEventListener('click', () => {
  sidebar.classList.toggle('hidden');
  mainContent.classList.toggle('expanded');
});

// =====================
// AVATAR DROPDOWN
// =====================
const avatarBtn = document.getElementById('avatarBtn');
const avatarDropdown = document.getElementById('avatarDropdown');

avatarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  avatarDropdown.classList.toggle('show');
});

document.addEventListener('click', () => {
  avatarDropdown.classList.remove('show');
});

// =====================
// LOGOUT
// =====================
function logout() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/';
}

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("dropdownLogout").addEventListener("click", logout);

// =====================
// DATA LOAD
// =====================
const tableBody = document.querySelector("#appointmentTable tbody");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");

async function loadAppointments() {
  try {
    const status = statusFilter.value;
    const search = searchInput.value;

    let url = `/api/admin/appointments?`;

    if (status) url += `status=${status}&`;
    if (search) url += `search=${search}`;

    const res = await fetch(url);
    const data = await res.json();

    tableBody.innerHTML = "";

    data.forEach(app => {
      tableBody.innerHTML += `
        <tr style="border-top:1px solid #eee;">
          <td style="padding:12px;">${app.patient?.fullName || ""}</td>
          <td style="padding:12px;">${app.psychiatrist?.fullName || ""}</td>
          <td style="padding:12px;">${new Date(app.date).toLocaleString()}</td>
          <td style="padding:12px; font-weight:500;">${app.status}</td>
        </tr>
      `;
    });

  } catch (err) {
    console.log("Error loading appointments:", err);
  }
}

// =====================
// EVENTS
// =====================
statusFilter.addEventListener("change", loadAppointments);
searchInput.addEventListener("keyup", loadAppointments);

// INITIAL LOAD
loadAppointments();