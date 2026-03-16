const tableBody = document.querySelector("#reviewTable tbody");

async function loadReviews() {

  const res = await fetch("/api/admin/reviews");
  const data = await res.json();

  tableBody.innerHTML = "";

  data.forEach(r => {

    tableBody.innerHTML += `
    
    <tr>

    <td>${r.patientName}</td>

    <td>${r.psychiatristName}</td>

    <td>${r.rating} ⭐</td>

    <td>${r.comment}</td>

    <td>${new Date(r.createdAt).toLocaleDateString()}</td>

    <td>

    <button onclick="deleteReview('${r._id}')">

    Delete

    </button>

    </td>

    </tr>
    
    `;

  });

}

loadReviews();

async function deleteReview(id) {

  if(confirm("Delete this review?")){

    await fetch(`/api/admin/reviews/delete/${id}`, {
      method: "DELETE"
    });

    loadReviews();

  }

}