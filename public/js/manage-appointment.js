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

    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (search.trim()) params.append("search", search.trim());

    const res = await adminFetch(`/api/admin/appointments?${params.toString()}`);
    const data = await res.json();

    tableBody.innerHTML = "";

    if (!Array.isArray(data)) {
      console.log("Error loading appointments:", data);
      return;
    }

    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="padding:20px; text-align:center; color:#888;">No appointments found</td></tr>`;
      return;
    }

    data.forEach(app => {

      function formatTime12(timeStr) {
        const [start, end] = timeStr.trim().split('–');

        const convert = (t) => {
          let [h, m] = t.trim().split(':');
          h = parseInt(h);
          const ampm = h >= 12 ? 'PM' : 'AM';
          h = h % 12 || 12;
          return `${h}:${m} ${ampm}`;
        };

        return `${convert(start)} – ${convert(end)}`;
      }

      const formattedTime = app.timeSlot
        ? formatTime12(app.timeSlot)
        : "";

      // If the account was deleted, populate() returns null, so fall back to the name saved on the appointment
      const patientName = app.patient?.fullName || (app.patientName ? `${app.patientName} (deleted)` : "—");
      const psyName = app.psychiatrist?.fullName || (app.psychiatristName ? `${app.psychiatristName} (deleted)` : "—");

      tableBody.innerHTML += `
    <tr style="border-top:1px solid #eee;">
      <td style="padding:12px;">${patientName}</td>
      <td style="padding:12px;">${psyName}</td>
      <td style="padding:12px;">${app.date} | ${formattedTime}</td>
      <td style="padding:12px; font-weight:500; text-transform:capitalize;">${app.status}</td>
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