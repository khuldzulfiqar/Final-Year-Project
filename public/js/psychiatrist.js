// SIDEBAR
const toggleBtn = document.getElementById('toggleBtn');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');

toggleBtn?.addEventListener('click', () => {
  sidebar.classList.toggle('hidden');
  mainContent.classList.toggle('expanded');
});

// DROPDOWN
const avatarBtn = document.getElementById('avatarBtn');
const avatarDropdown = document.getElementById('avatarDropdown');

avatarBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  avatarDropdown.classList.toggle('show');
});

document.addEventListener('click', () => {
  avatarDropdown?.classList.remove('show');
});

// LOGOUT
function logout() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "/";
}

document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("dropdownLogout").addEventListener("click", logout);

// DATA
const tableBody = document.querySelector("#psyTable tbody");
const searchInput = document.getElementById("searchInput");

async function loadPsychiatrists(search = "") {
  const url = search
    ? `/api/admin/psychiatrists?search=${search}`
    : `/api/admin/psychiatrists`;

  const res = await fetch(url);
  const data = await res.json();

  tableBody.innerHTML = "";

  data.forEach(p => {
    tableBody.innerHTML += `
      <tr style="border-top:1px solid #eee;">
        <td style="padding:12px;">${p.fullName || "—"}</td>
        <td style="padding:12px;">${p.email || "—"}</td>
        <td style="padding:12px;">${p.specialization || "—"}</td>
        <td style="padding:12px;">${p.status || "Pending"}</td>
        <td style="padding:12px;">
          <div class="action-group">
            <button class="icon-btn btn-approve" title="Approve" aria-label="Approve"
              onclick="approve('${p._id}')" ${p.status === "Approved" ? "disabled" : ""}>
              <i class="ti ti-check"></i>
            </button>
            <button class="icon-btn btn-reject" title="Reject" aria-label="Reject"
              onclick="rejectPsy('${p._id}')" ${p.status === "Rejected" ? "disabled" : ""}>
              <i class="ti ti-x"></i>
            </button>
            <button class="icon-btn btn-delete" title="Delete" aria-label="Delete"
              onclick="deletePsy('${p._id}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
}

function approve(id) { fetch(`/api/admin/approve/${id}`, { method: "PUT" }).then(loadPsychiatrists); }
function rejectPsy(id) { fetch(`/api/admin/reject/${id}`, { method: "PUT" }).then(loadPsychiatrists); }
function deletePsy(id) {
  if (!confirm("Delete this psychiatrist? This cannot be undone.")) return;
  fetch(`/api/admin/delete/${id}`, { method: "DELETE" }).then(loadPsychiatrists);
}

searchInput?.addEventListener("keyup", () => {
  loadPsychiatrists(searchInput.value);
});

loadPsychiatrists();