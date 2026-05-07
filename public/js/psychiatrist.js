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
  <button class="btn btn-approve" onclick="approve('${p._id}')">
    Approve
  </button>

  <button class="btn btn-reject" onclick="rejectPsy('${p._id}')">
    Reject
  </button>

  <button class="btn btn-delete" onclick="deletePsy('${p._id}')">
    Delete
  </button>
</td>
      </tr>
    `;
  });
}

function approve(id) { fetch(`/api/admin/approve/${id}`, { method: "PUT" }).then(loadPsychiatrists); }
function rejectPsy(id) { fetch(`/api/admin/reject/${id}`, { method: "PUT" }).then(loadPsychiatrists); }
function deletePsy(id) { fetch(`/api/admin/delete/${id}`, { method: "DELETE" }).then(loadPsychiatrists); }

searchInput?.addEventListener("keyup", () => {
  loadPsychiatrists(searchInput.value);
});

loadPsychiatrists();