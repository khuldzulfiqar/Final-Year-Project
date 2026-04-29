const tableBody = document.querySelector("#appointmentTable tbody");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");

async function loadAppointments() {
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
      <tr>
        <td>${app.patient?.fullName || ""}</td>
        <td>${app.psychiatrist?.fullName || ""}</td>
        <td>${new Date(app.date).toLocaleString()}</td>
        <td>${app.status}</td>
      </tr>
    `;
  });
}

// 👇 EVENTS (VERY IMPORTANT)
statusFilter.addEventListener("change", loadAppointments);
searchInput.addEventListener("keyup", loadAppointments);

// initial load
loadAppointments();
document.getElementById("logoutBtn").addEventListener("click", function () {
  console.log("Logout clicked");

  localStorage.clear();
  sessionStorage.clear();

  window.location.href = '/';
});