const tableBody = document.querySelector("#reviewTable tbody");

const searchInput = document.getElementById("searchInput");

async function loadReviews() {

  const search = searchInput.value;

  const res = await fetch(`/api/admin/reviews?search=${search}`);
  const data = await res.json();

  tableBody.innerHTML = "";

  data.forEach(r => {

    tableBody.innerHTML += `
      <tr>
        <td>${r.patient?.fullName || ""}</td>
        <td>${r.psychiatrist?.fullName || ""}</td>
        <td>${r.rating} ⭐</td>
        <td>${r.comment}</td>
        <td>${new Date(r.createdAt).toLocaleDateString()}</td>
        <td>
          <button onclick="deleteReview('${r._id}')">Delete</button>
        </td>
      </tr>
    `;

  });

}

// live search
searchInput.addEventListener("keyup", loadReviews);

loadReviews();

async function deleteReview(id) {

  if(confirm("Delete this review?")){

    await fetch(`/api/admin/reviews/delete/${id}`, {
      method: "DELETE"
    });

    loadReviews();

  }

}
document.getElementById("logoutBtn").addEventListener("click", function () {
  console.log("Logout clicked");

  localStorage.clear();
  sessionStorage.clear();

  window.location.href = '/';
});