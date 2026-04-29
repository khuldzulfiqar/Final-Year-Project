async function loadFooter() {
  const res = await fetch("/admin/footer.html");
  const data = await res.text();
  document.getElementById("footer-container").innerHTML = data;
}

loadFooter();