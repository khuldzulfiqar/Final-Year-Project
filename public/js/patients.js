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
// PATIENT DATA
// =====================
const tableBody = document.querySelector("#patientsTable tbody");
const searchInput = document.getElementById("search");

let patients = [];

async function loadPatients() {
  const res = await fetch("/api/admin/patients");
  patients = await res.json();
  displayPatients(patients);
}

function displayPatients(data) {
  tableBody.innerHTML = "";

  data.forEach(patient => {
    tableBody.innerHTML += `
      <tr style="border-top:1px solid #eee;">
        <td style="padding:12px;">${patient.fullName || ""}</td>
        <td style="padding:12px;">${patient.email || ""}</td>

        <td style="padding:12px;">
          <button onclick="viewProfile('${patient._id}')"
            style="padding:6px 10px; border:none; border-radius:6px; background:#0d7377; color:white; cursor:pointer;">
            View
          </button>
        </td>

        <td style="padding:12px;">
          <button onclick="deletePatient('${patient._id}')"
            style="padding:6px 10px; border:none; border-radius:6px; background:#e74c3c; color:white; cursor:pointer;">
            Delete
          </button>
        </td>
      </tr>
    `;
  });
}

function viewProfile(id) {
  window.location.href = "/patient-profile?id=" + id;
}

async function deletePatient(id) {
  if (confirm("Delete this patient?")) {
    await fetch("/api/admin/patient/" + id, { method: "DELETE" });
    loadPatients();
  }
}

// =====================
// SEARCH
// =====================
searchInput.addEventListener("keyup", () => {
  const value = searchInput.value.toLowerCase();

  const filtered = patients.filter(p =>
    (p.fullName || "").toLowerCase().includes(value) ||
    (p.email || "").toLowerCase().includes(value)
  );

  displayPatients(filtered);
});

// INITIAL LOAD
loadPatients();