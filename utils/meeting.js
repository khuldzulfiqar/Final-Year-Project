// Validates the online-consultation link a psychiatrist pastes (Meet / Zoom / Teams ...).
// Provider logic lives only here, so an auto-generator (e.g. Google Meet API) can be added later
// without touching routes or pages.

const ALLOWED_HOSTS = [
  { match: h => h === 'meet.google.com',                               provider: 'google_meet' },
  { match: h => h === 'zoom.us' || h.endsWith('.zoom.us'),             provider: 'zoom' },
  { match: h => h === 'teams.microsoft.com' || h === 'teams.live.com', provider: 'teams' },
  { match: h => h === 'whereby.com' || h.endsWith('.whereby.com'),     provider: 'other' },
  { match: h => h === 'jit.si' || h.endsWith('.jit.si'),               provider: 'other' }
];

// Blank input is valid ({ link: '' }): the appointment is accepted and the link is added later.
function normalizeMeetingLink(input) {
  const raw = (input || '').trim();
  if (!raw) return { ok: true, link: '', provider: '' };

  let url;
  try { url = new URL(raw); }
  catch { return { ok: false, error: 'Meeting link is not a valid URL.' }; }

  if (url.protocol !== 'https:')
    return { ok: false, error: 'Meeting link must start with https://' };

  const hit = ALLOWED_HOSTS.find(a => a.match(url.hostname.toLowerCase()));
  if (!hit)
    return { ok: false, error: 'Please use a Google Meet, Zoom, Microsoft Teams or Whereby link.' };

  return { ok: true, link: url.href, provider: hit.provider };
}

module.exports = { normalizeMeetingLink };
