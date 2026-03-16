const tableBody = document.querySelector("#patientsTable tbody");
const searchInput = document.getElementById("search");

let patients = [];

async function loadPatients(){

const res = await fetch("/api/admin/patients");

patients = await res.json();

displayPatients(patients);

}

function displayPatients(data){

tableBody.innerHTML = "";

data.forEach(patient => {

const row = `
<tr>

<td>${patient.name}</td>
<td>${patient.email}</td>

<td>
<button class="view-btn" onclick="viewProfile('${patient._id}')">View</button>
</td>

<td>
<button class="delete-btn" onclick="deletePatient('${patient._id}')">Delete</button>
</td>

</tr>
`;

tableBody.innerHTML += row;

});

}

function viewProfile(id){

window.location.href = "patient-profile.html?id=" + id;

}

async function deletePatient(id){

if(confirm("Delete this patient?")){

await fetch("/api/admin/patient/" + id,{
method:"DELETE"
});

loadPatients();

}

}

searchInput.addEventListener("keyup", function(){

const value = searchInput.value.toLowerCase();

const filtered = patients.filter(p =>
p.name.toLowerCase().includes(value) ||
p.email.toLowerCase().includes(value)
);

displayPatients(filtered);

});

loadPatients();