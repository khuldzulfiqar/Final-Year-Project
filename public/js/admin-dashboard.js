// console.log("Admin JS Loaded");
// function logout() {
//   Auth.clear();
//   showToast('Logged out successfully', 'success');
//   setTimeout(() => window.location.href = '/login', 800);
// }
console.log("JS Loaded");

document.getElementById("logoutBtn").addEventListener("click", function () {
  console.log("Logout clicked");

  localStorage.clear();
  sessionStorage.clear();

  window.location.href = '/';
});

async function loadCounts() {
  try {
    const res = await fetch("/api/admin/dashboard-counts");
    const data = await res.json();

    document.getElementById("patientsCount").textContent = data.patients;
    document.getElementById("psychiatristsCount").textContent = data.psychiatrists;
    document.getElementById("appointmentsCount").textContent = data.appointments;
    document.getElementById("reviewsCount").textContent = data.reviews;

  } catch (err) {
    console.log(err);
  }
}

loadCounts();