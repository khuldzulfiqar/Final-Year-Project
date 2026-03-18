function logout() {
  Auth.clear();
  showToast('Logged out successfully', 'success');
  setTimeout(() => window.location.href = '/login', 800);
}