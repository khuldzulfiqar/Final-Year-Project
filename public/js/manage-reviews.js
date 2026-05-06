console.log("Manage Reviews Loaded");

// =====================
// ELEMENTS
// =====================
const tableBody = document.querySelector("#reviewTable tbody");
const searchInput = document.getElementById("searchInput");

// =====================
// SIDEBAR TOGGLE (if exists globally)
// =====================
const toggleBtn = document.getElementById('toggleBtn');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');

toggleBtn?.addEventListener('click', () => {
  sidebar.classList.toggle('hidden');
  mainContent.classList.toggle('expanded');
});

// =====================
// AVATAR DROPDOWN
// =====================
const avatarBtn = document.getElementById('avatarBtn');
const avatarDropdown = document.getElementById('avatarDropdown');

avatarBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  avatarDropdown.classList.toggle('show');
});

document.addEventListener('click', () => {
  avatarDropdown?.classList.remove('show');
});

// =====================
// LOGOUT
// =====================
function logout() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "/";
}

document.getElementById("logoutBtn")?.addEventListener("click", logout);
document.getElementById("dropdownLogout")?.addEventListener("click", logout);

// =====================
// LOAD REVIEWS
// =====================
async function loadReviews() {
  try {
    const search = searchInput.value.trim();

    const res = await fetch(`/api/admin/reviews?search=${search}`);
    const data = await res.json();

    tableBody.innerHTML = "";

    if (!data.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:20px; color:#888;">
            No reviews found
          </td>
        </tr>
      `;
      return;
    }

    data.forEach(r => {
      tableBody.innerHTML += `
        <tr style="border-top:1px solid #eee;">
          <td style="padding:12px;">${r.patient?.fullName || "—"}</td>
          <td style="padding:12px;">${r.psychiatrist?.fullName || "—"}</td>
          <td style="padding:12px;">${r.rating} ⭐</td>
          <td style="padding:12px;">${r.comment || "—"}</td>
          <td style="padding:12px;">${new Date(r.createdAt).toLocaleDateString()}</td>
          <td style="padding:12px;">
            <button onclick="deleteReview('${r._id}')"
              style="background:#e74c3c; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;">
              Delete
            </button>
          </td>
        </tr>
      `;
    });

  } catch (err) {
    console.log("Error loading reviews:", err);
  }
}

// =====================
// DELETE REVIEW
// =====================
async function deleteReview(id) {
  if (!confirm("Delete this review?")) return;

  try {
    await fetch(`/api/admin/reviews/delete/${id}`, {
      method: "DELETE"
    });

    loadReviews();
  } catch (err) {
    console.log("Delete error:", err);
  }
}

// =====================
// SEARCH
// =====================
searchInput?.addEventListener("keyup", loadReviews);

// INITIAL LOAD
loadReviews();