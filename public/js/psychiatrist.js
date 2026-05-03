// ===============================
// Manage Psychiatrists Script
// ===============================

// -------------------------------
// Load Psychiatrists
// -------------------------------
async function loadPsychiatrists(search = "") {
  try {
    const url = search
      ? `/api/admin/psychiatrists?search=${encodeURIComponent(search)}`
      : `/api/admin/psychiatrists`;

    const res = await fetch(url);
    const data = await res.json();

    const tableBody = document.querySelector("#psyTable tbody");
    tableBody.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#718096;padding:1.5rem;">No psychiatrists found.</td></tr>`;
      return;
    }

    data.forEach(p => {
      tableBody.innerHTML += `
        <tr>
          <td>${p.fullName || "—"}</td>
          <td>${p.email || "—"}</td>
          <td>${p.specialization || "—"}</td>
          <td>${p.status || "Pending"}</td>
          <td>
            <button onclick="approve('${p._id}')">Approve</button>
            <button onclick="rejectPsy('${p._id}')">Reject</button>
            <button onclick="deletePsy('${p._id}')">Delete</button>
          </td>
        </tr>
      `;
    });

  } catch (error) {
    console.error("Error loading psychiatrists:", error);
    const tableBody = document.querySelector("#psyTable tbody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#e53e3e;padding:1.5rem;">Failed to load psychiatrists. Check console for details.</td></tr>`;
    }
  }
}

// -------------------------------
// Approve
// -------------------------------
async function approve(id) {
  await fetch(`/api/admin/approve/${id}`, { method: "PUT" });
  loadPsychiatrists();
}

// -------------------------------
// Reject
// -------------------------------
async function rejectPsy(id) {
  await fetch(`/api/admin/reject/${id}`, { method: "PUT" });
  loadPsychiatrists();
}

// -------------------------------
// Delete
// -------------------------------
async function deletePsy(id) {
  if (!confirm("Are you sure you want to delete this psychiatrist?")) return;
  await fetch(`/api/admin/delete/${id}`, { method: "DELETE" });
  loadPsychiatrists();
}

// -------------------------------
// Init on DOM ready
// -------------------------------
document.addEventListener("DOMContentLoaded", function () {
  // Initial load
  loadPsychiatrists();

  // Search
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("keyup", function () {
      loadPsychiatrists(searchInput.value.trim());
    });
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/";
    });
  }
});
