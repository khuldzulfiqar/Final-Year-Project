// ── SIDEBAR ──
const toggleBtn = document.getElementById('toggleBtn');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');

toggleBtn?.addEventListener('click', () => {
  sidebar.classList.toggle('hidden');
  mainContent.classList.toggle('expanded');
});

// ── AVATAR DROPDOWN ──
const avatarBtn = document.getElementById('avatarBtn');
const avatarDropdown = document.getElementById('avatarDropdown');

avatarBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  avatarDropdown.classList.toggle('show');
});
document.addEventListener('click', () => {
  avatarDropdown?.classList.remove('show');
});

// ── LOGOUT ──
function logout() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/';
}
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('dropdownLogout').addEventListener('click', logout);

// ── TABLE ──
const tableBody = document.querySelector('#psyTable tbody');
const searchInput = document.getElementById('searchInput');

async function loadPsychiatrists(search = '') {
  const url = search ? `/api/admin/psychiatrists?search=${encodeURIComponent(search)}` : '/api/admin/psychiatrists';
  const res = await fetch(url);
  const data = await res.json();

  tableBody.innerHTML = '';

  if (!data.length) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#888;">No psychiatrists found.</td></tr>`;
    return;
  }

  data.forEach(p => {
    const statusColor = p.status === 'Approved' ? '#16a34a' : p.status === 'Rejected' ? '#dc2626' : '#d97706';
    tableBody.innerHTML += `
      <tr style="border-top:1px solid #eee;">
        <td style="padding:12px;">${p.fullName || '—'}</td>
        <td style="padding:12px;">${p.email || '—'}</td>
        <td style="padding:12px;">${p.specialization || '—'}</td>
        <td style="padding:12px;">
          <span style="background:${statusColor}20;color:${statusColor};padding:3px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;">
            ${p.status || 'Pending'}
          </span>
        </td>
        <td style="padding:8px 12px;">
          <div style="display:flex;gap:4px;flex-wrap:nowrap;align-items:center;">
            <button class="btn btn-view" onclick="viewProfile('${p._id}')" style="white-space:nowrap;padding:4px 8px;font-size:11px;">👁 View</button>
            <button class="btn btn-approve" onclick="approve('${p._id}')" style="white-space:nowrap;padding:4px 8px;font-size:11px;">✓ Approve</button>
            <button class="btn btn-reject" onclick="rejectPsy('${p._id}')" style="white-space:nowrap;padding:4px 8px;font-size:11px;">✗ Reject</button>
            <button class="btn btn-delete" onclick="deletePsy('${p._id}')" style="white-space:nowrap;padding:4px 8px;font-size:11px;">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `;
  });
}

// ── ACTIONS ──
function approve(id) {
  fetch(`/api/admin/approve/${id}`, { method: 'PUT' }).then(() => loadPsychiatrists(searchInput.value));
}
function rejectPsy(id) {
  fetch(`/api/admin/reject/${id}`, { method: 'PUT' }).then(() => loadPsychiatrists(searchInput.value));
}
function deletePsy(id) {
  if (!confirm('Delete this psychiatrist?')) return;
  fetch(`/api/admin/delete/${id}`, { method: 'DELETE' }).then(() => loadPsychiatrists(searchInput.value));
}

// ── VIEW PROFILE MODAL ──
async function viewProfile(id) {
  document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:24px;color:#888;">Loading...</p>';
  document.getElementById('profileModal').classList.add('active');

  try {
    const res = await fetch(`/api/admin/psychiatrist/${id}`);
    const p = await res.json();

    const statusColor = p.status === 'Approved' ? '#16a34a' : p.status === 'Rejected' ? '#dc2626' : '#d97706';

    const address = [p.clinicAddress?.street, p.clinicAddress?.city, p.clinicAddress?.state, p.clinicAddress?.country]
      .filter(Boolean).join(', ');

    const modes = [
      p.consultationModes?.online ? 'Online' : '',
      p.consultationModes?.inPerson ? 'In-Person' : ''
    ].filter(Boolean).join(', ') || '—';

    document.getElementById('modalBody').innerHTML = `
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #eee;">
        <div style="width:60px;height:60px;border-radius:50%;background:#0d737715;display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0;overflow:hidden;">
          ${p.profileImage ? `<img src="${p.profileImage}" style="width:60px;height:60px;object-fit:cover;">` : '👨‍⚕️'}
        </div>
        <div>
          <div style="font-size:1.1rem;font-weight:700;color:#1a1a2e;">${p.fullName || '—'}</div>
          <div style="font-size:0.85rem;color:#666;margin-top:2px;">${p.specialization || 'Psychiatrist'}</div>
          <span style="background:${statusColor}20;color:${statusColor};padding:2px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;display:inline-block;margin-top:5px;">
            ${p.status || 'Pending'}
          </span>
        </div>
      </div>

      <!-- Fields grid -->
      <div class="profile-grid">
        ${pfield('📧 Email', p.email)}
        ${pfield('📱 Phone', p.phone)}
        ${pfield('🪪 CNIC', p.cnic)}
        ${pfield('🎂 Age', p.age)}
        ${pfield('⚧ Gender', p.gender)}
        ${pfield('🏥 License Number', p.licenseNumber, true)}
        ${pfield('🎓 Qualification', p.qualification)}
        ${pfield('💼 Experience', p.experience)}
        ${pfield('💰 Consultation Fee', p.consultationFee ? 'Rs. ' + p.consultationFee : null)}
        ${pfield('🖥 Consultation Modes', modes)}
      </div>

      ${p.bio ? `
        <div style="background:#f8f8f8;border-radius:8px;padding:12px 14px;border-left:3px solid #0d7377;margin-bottom:10px;">
          <div style="font-size:0.72rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px;">Bio</div>
          <div style="font-size:0.9rem;color:#444;line-height:1.55;">${p.bio}</div>
        </div>` : ''}

      ${address ? `
        <div style="background:#f8f8f8;border-radius:8px;padding:12px 14px;margin-bottom:10px;">
          <div style="font-size:0.72rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px;">📍 Clinic Address</div>
          <div style="font-size:0.9rem;color:#444;">${address}</div>
        </div>` : ''}

      <div class="modal-actions">
        <button class="btn-approve-modal" onclick="approve('${p._id}'); closeModal();">✓ Approve</button>
        <button class="btn-reject-modal" onclick="rejectPsy('${p._id}'); closeModal();">✗ Reject</button>
      </div>
    `;
  } catch (e) {
    document.getElementById('modalBody').innerHTML = '<p style="text-align:center;padding:24px;color:#e00;">Failed to load profile.</p>';
  }
}

function pfield(label, value, highlight = false) {
  if (value === null || value === undefined || value === '') return '';
  return `
    <div class="profile-field ${highlight ? 'highlight' : ''}">
      <div class="field-label">${label}</div>
      <div class="field-value">${value}</div>
    </div>`;
}

function closeModal() {
  document.getElementById('profileModal').classList.remove('active');
}

// Close on backdrop click
document.getElementById('profileModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── SEARCH ──
searchInput?.addEventListener('keyup', () => loadPsychiatrists(searchInput.value));

// ── INIT ──
loadPsychiatrists();
