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
  const res = await adminFetch("/api/admin/patients");
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
          <div class="action-group">
            <button class="icon-btn btn-view" title="View profile" aria-label="View profile"
              onclick="viewProfile('${patient._id}')">
              <i class="ti ti-eye"></i>
            </button>
          </div>
        </td>

        <td style="padding:12px;">
          <div class="action-group">
            <button class="icon-btn btn-delete" title="Delete patient" aria-label="Delete patient"
              onclick="deletePatient('${patient._id}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>
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
    await adminFetch("/api/admin/patient/" + id, { method: "DELETE" });
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