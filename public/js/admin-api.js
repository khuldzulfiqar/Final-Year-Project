// Shared helper for admin pages: sends the JWT with every /api/admin request.
async function adminFetch(url, options = {}) {
  const token = localStorage.getItem('mb_token');
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: 'Bearer ' + token }
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  }
  return res;
}
