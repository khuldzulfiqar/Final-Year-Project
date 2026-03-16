// ===============================
// Manage Psychiatrists Script
// ===============================

const tableBody = document.querySelector("#psyTable tbody");

// -------------------------------
// Load Psychiatrists
// -------------------------------
async function loadPsychiatrists() {
  try {
    const res = await fetch("/api/admin/psychiatrists");
    const data = await res.json();

    tableBody.innerHTML = "";

    data.forEach(p => {
      tableBody.innerHTML += `
        <tr>
          <td>${p.fullName}</td>
          <td>${p.email}</td>
          <td>${p.specialization || ""}</td>
          <td>${p.status}</td>
          <td>
            <button onclick="approve('${p._id}')">Approve</button>
            <button onclick="reject('${p._id}')">Reject</button>
            <button onclick="deleteP('${p._id}')">Delete</button>
          </td>
        </tr>
      `;
    });

  } catch (error) {
    console.error("Error loading psychiatrists:", error);
  }
}

// -------------------------------
// Search Function (Safe Version)
// -------------------------------
const searchInput = document.getElementById("searchInput");

if (searchInput) {
  searchInput.addEventListener("keyup", function () {
    const filter = searchInput.value.toLowerCase();
    const rows = document.querySelectorAll("#psyTable tbody tr");

    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(filter) ? "" : "none";
    });
  });
}

// -------------------------------
// Approve
// -------------------------------
async function approve(id) {
  await fetch(`/api/admin/approve/${id}`, {
    method: "PUT"
  });

  loadPsychiatrists();
}

// -------------------------------
// Reject
// -------------------------------
async function reject(id) {
  await fetch(`/api/admin/reject/${id}`, {
    method: "PUT"
  });

  loadPsychiatrists();
}

// -------------------------------
// Delete
// -------------------------------
async function deleteP(id) {
  await fetch(`/api/admin/delete/${id}`, {
    method: "DELETE"
  });

  loadPsychiatrists();
}

// -------------------------------
// Initial Load
// -------------------------------
loadPsychiatrists();