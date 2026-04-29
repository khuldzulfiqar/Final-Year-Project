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
            <button onclick="view('${p._id}')">View</button>
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

searchInput.addEventListener("keyup", async function () {

  const value = searchInput.value;

  const res = await fetch(`/api/admin/psychiatrists?search=${value}`);
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
          <button onclick="view('${p._id}')">View</button>
          <button onclick="approve('${p._id}')">Approve</button>
          <button onclick="reject('${p._id}')">Reject</button>
          <button onclick="delete('${p._id}')">Delete</button>
        </td>
      </tr>
    `;
  });

});

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
 function view(id){

window.location.href = "/pages/psychiatrists.html?id=" + id;


}

// -------------------------------
// Initial Load
// -------------------------------
loadPsychiatrists();
document.getElementById("logoutBtn").addEventListener("click", function () {
  console.log("Logout clicked");

  localStorage.clear();
  sessionStorage.clear();

  window.location.href = '/';
});