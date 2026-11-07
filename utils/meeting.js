// Automatic online-consultation room (no manual links).
// Every accepted + paid online appointment gets its own private room inside MindBridge.
// Video is provided by Jitsi as a Service (JaaS, 8x8) and embedded in /meeting.
// If the JaaS keys are not set in .env, it falls back to a plain meet.jit.si room.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const TZ_OFFSET = process.env.APP_TZ_OFFSET || '+05:00';   // Pakistan (no DST)
const EARLY_MIN = 10;                                       // room opens 10 min before start
const GRACE_MIN = 10;                                       // can still (re)join up to 10 min after the slot ends
const SECRET = process.env.JWT_SECRET || 'mindbridge-jwt-secret';

// "2026-10-25" + "14:00 – 15:00" -> { start, end } as real Dates (independent of server time zone)
function slotWindow(date, timeSlot) {
  const parts = String(timeSlot || '').split(/[–-]/).map(x => x.trim().padStart(5, '0'));
  if (parts.length < 2) return null;
  const start = new Date(`${date}T${parts[0]}:00${TZ_OFFSET}`);
  const end = new Date(`${date}T${parts[1]}:00${TZ_OFFSET}`);
  return isNaN(start) || isNaN(end) ? null : { start, end };
}

// 'early' | 'open' | 'ended' | null (null = not an online accepted appointment)
function meetingState(a, now = new Date()) {
  if (!a || a.consultationMode !== 'online' || a.status !== 'accepted') return null;
  const w = slotWindow(a.date, a.timeSlot);
  if (!w) return null;
  if (now >= new Date(w.end.getTime() + GRACE_MIN * 60000)) return 'ended';
  if (now < new Date(w.start.getTime() - EARLY_MIN * 60000)) return 'early';
  return 'open';
}

// Unguessable room name derived from the appointment id
function roomName(a) {
  return 'MindBridge-' + crypto.createHmac('sha256', SECRET).update(String(a._id)).digest('hex').slice(0, 20);
}

function jaasConfigured() {
  return !!(process.env.JAAS_APP_ID && process.env.JAAS_KEY_ID && process.env.JAAS_PRIVATE_KEY);
}

// Everything the /meeting page needs to join. The doctor is the moderator.
function buildJoinInfo(a, { userId, name, email, isModerator }) {
  const room = roomName(a);

  if (!jaasConfigured()) {
    return { provider: 'public', domain: 'meet.jit.si', room, url: `https://meet.jit.si/${room}`, displayName: name };
  }

  const appId = process.env.JAAS_APP_ID;
  const w = slotWindow(a.date, a.timeSlot);
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      aud: 'jitsi',
      iss: 'chat',
      sub: appId,
      room,                                   // token only works for THIS appointment's room
      nbf: now - 10,
      exp: Math.floor(w.end.getTime() / 1000) + (GRACE_MIN + 20) * 60,
      context: {
        user: { id: String(userId), name, email: email || '', moderator: isModerator ? 'true' : 'false' },
        features: { recording: 'false', livestreaming: 'false', transcription: 'false', 'outbound-call': 'false' }
      }
    },
    process.env.JAAS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    { algorithm: 'RS256', header: { alg: 'RS256', kid: process.env.JAAS_KEY_ID, typ: 'JWT' } }
  );

  return { provider: 'jaas', domain: '8x8.vc', appId, room, jwt: token, displayName: name };
}

module.exports = { slotWindow, meetingState, roomName, buildJoinInfo, jaasConfigured, EARLY_MIN, GRACE_MIN };
