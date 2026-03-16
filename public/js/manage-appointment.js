const tableBody = document.querySelector("#appointmentTable tbody");
const statusFilter = document.getElementById("statusFilter");

// Load All
async function loadAppointments(url = "/api/admin/appointments") {
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

loadAppointments();

// Filter
statusFilter.addEventListener("change", function () {
  const value = statusFilter.value;

  if (value === "") {
    loadAppointments();
  } else {
    loadAppointments(`/api/admin/appointments/status/${value}`);
  }
});

// Search
const searchInput = document.getElementById("searchInput");

if (searchInput) {
  searchInput.addEventListener("keyup", function () {
    const filter = searchInput.value.toLowerCase();
    const rows = document.querySelectorAll("#appointmentTable tbody tr");

    rows.forEach(row => {
      row.style.display =
        row.innerText.toLowerCase().includes(filter)
          ? ""
          : "none";
    });
  });
}