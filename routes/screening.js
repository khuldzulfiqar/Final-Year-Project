const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const ScreeningSession = require('../models/ScreeningSession');
const {
  SECTION_ORDER, BASELINE_ORDER, MAX_QUESTIONS, EXTENDED_MAP, BY_COLUMN
} = require('./screeningData');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge-jwt-secret';

// Same pattern as routes/appointments.js — token is optional here since a
// screening can be taken before/without login, but we attach the patient
// when one is present.
function getUser(req) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function requireAuth(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ success: false, message: 'Login required' });
  req.user = user;
  next();
}

function questionPayload(column) {
  const q = BY_COLUMN[column];
  if (!q) return null;
  return { column: q.column, section: q.section, text: q.text, crisis: !!q.crisis };
}

/**
 * Decide the next question column for a session, or null if the session
 * should end. Pure function of session state — the server is always the
 * source of truth, the client never picks its own next question.
 */
function pickNextColumn(session) {
  const asked = session.askedColumns;

  // Phase 1: fixed, mixed baseline (covers all 4 sections + the crisis check).
  if (asked.length < BASELINE_ORDER.length) {
    return BASELINE_ORDER[asked.length];
  }

  // Phase 2: adaptive follow-ups, only for sections the baseline triggered
  // (at least one "Yes" among that section's core/baseline questions).
  if (asked.length >= MAX_QUESTIONS) return null;

  const maxExtended = MAX_QUESTIONS - BASELINE_ORDER.length;
  const extendedAskedCount = asked.length - BASELINE_ORDER.length;
  if (extendedAskedCount >= maxExtended) return null;

  const activeSections = session.activeSections || [];
  if (activeSections.length === 0) return null;

  // Prioritize the section with the strongest signal so far (highest
  // percentage of "Yes" answers, ties broken by raw "Yes" count) and ask
  // ALL of its remaining extended questions before moving to the next
  // triggered section. This keeps follow-ups focused on the condition
  // that's actually looking likely, instead of diluting the picture by
  // mixing questions from every triggered section together.
  const prioritized = [...activeSections].sort((a, b) => {
    const sa = session.sectionScores[a] || { percentage: 0, yes: 0 };
    const sb = session.sectionScores[b] || { percentage: 0, yes: 0 };
    if (sb.percentage !== sa.percentage) return sb.percentage - sa.percentage;
    return sb.yes - sa.yes;
  });

  for (const section of prioritized) {
    const remaining = (EXTENDED_MAP[section] || []).filter(col => !asked.includes(col));
    if (remaining.length > 0) return remaining[0];
  }
  return null;
}

function recomputeActiveSections(session) {
  const active = [];
  for (const section of SECTION_ORDER) {
    const score = session.sectionScores[section];
    if (score && score.yes >= 1) active.push(section);
  }
  session.activeSections = active;
}

function initSectionScores() {
  const scores = {};
  for (const s of SECTION_ORDER) scores[s] = { asked: 0, yes: 0, percentage: 0 };
  return scores;
}

/**
 * Guidance content for the heuristic fallback path, keyed to the same
 * section names used throughout this file (SECTION_ORDER). Mirrors the
 * GUIDANCE dict in ml-service/main.py so the patient sees consistent
 * advice whether the real AI model answered or this fallback did.
 */
const GUIDANCE = {
  "Depression": {
    selfCare: [
      "Try to keep a consistent sleep and wake time, even on hard days.",
      "Break tasks into small steps — finishing one small thing counts.",
      "Reach out to one trusted person this week, even briefly."
    ],
    recommendedAction: "Book a consultation with a psychiatrist specializing in Depression.",
    urgency: "moderate"
  },
  "Anxiety": {
    selfCare: [
      "Practice slow breathing (4 seconds in, 6 seconds out) when worry spikes.",
      "Limit caffeine, which can worsen restlessness and racing thoughts.",
      "Write worries down instead of replaying them mentally."
    ],
    recommendedAction: "Book a consultation with a psychiatrist specializing in Anxiety.",
    urgency: "moderate"
  },
  "Bipolar Disorder": {
    selfCare: [
      "Track your mood daily — sudden energy/sleep changes are important signals.",
      "Keep a stable daily routine; irregular sleep can trigger mood shifts.",
      "Avoid major financial or life decisions during high-energy periods."
    ],
    recommendedAction: "See a psychiatrist specializing in Bipolar Disorder soon for a proper evaluation.",
    urgency: "high"
  },
  "Schizophrenia": {
    selfCare: [
      "Note down what you experience and when, to share with a professional.",
      "Stay connected to someone you trust — isolation can worsen symptoms.",
      "Avoid alcohol or recreational drugs, which can intensify symptoms."
    ],
    recommendedAction: "This pattern needs prompt evaluation — please book a psychiatrist appointment soon.",
    urgency: "high"
  }
};

const NO_SIGNAL_GUIDANCE = {
  selfCare: ['No strong pattern detected — keep monitoring how you feel.'],
  recommendedAction: 'No urgent action needed.',
  urgency: 'low'
};

/**
 * Rule-based fallback scorer, used when no external AI model endpoint is
 * configured (or if the call to it fails). Purely descriptive of the
 * answers given — NOT a diagnosis.
 */
function heuristicResult(session) {
  const summary = SECTION_ORDER.map(section => {
    const s = session.sectionScores[section] || { asked: 0, yes: 0, percentage: 0 };
    return { section, asked: s.asked, yes: s.yes, percentage: s.percentage };
  }).sort((a, b) => b.percentage - a.percentage);

  const notable = summary.filter(s => s.asked > 0 && s.percentage >= 50);
  const topSection = notable[0] && notable[0].section;

  return {
    source: 'heuristic-fallback',
    sectionSummary: summary,
    notableSections: notable.map(s => s.section),
    guidance: (topSection && GUIDANCE[topSection]) || NO_SIGNAL_GUIDANCE,
    disclaimer: 'This is an automated screening summary, not a clinical diagnosis. Please consult a licensed mental health professional for a full evaluation.'
  };
}

/**
 * Hook for the real AI model. Set AI_MODEL_URL in .env once the model
 * service is ready; payload matches the dataset column mapping
 * (Yes/No -> 1/0) for every question that was actually asked.
 */
async function runAIModel(session) {
  if (!process.env.AI_MODEL_URL) return null;
  try {
    const payload = { name: session.name, age: session.age, gender: session.gender, answers: {} };
    session.answers.forEach(a => { payload.answers[a.column] = a.value === 'Yes' ? 1 : 0; });

    const resp = await fetch(process.env.AI_MODEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return { source: 'ai-model', ...data };
  } catch (err) {
    console.log('AI model call failed, using heuristic fallback:', err.message);
    return null;
  }
}

async function completeSession(session) {
  session.status = 'completed';
  session.completedAt = new Date();
  const modelResult = await runAIModel(session);
  session.aiResult = modelResult || heuristicResult(session);
  await session.save();
}

// ---------------------------------------------------------------------
// POST /api/screening/start
// body: { name, age, gender }  — patient is attached automatically if
// the request carries a valid auth token, otherwise the session is
// taken as a guest (still stored in MongoDB).
// ---------------------------------------------------------------------
router.post('/start', async (req, res) => {
  try {
    const { name, age, gender } = req.body;
    if (!name || !age || !gender) {
      return res.status(400).json({ success: false, message: 'name, age and gender are required' });
    }
    const user = getUser(req);

    const session = await ScreeningSession.create({
      patient: user ? user.id : null,
      name, age, gender,
      sectionScores: initSectionScores(),
      askedColumns: [],
      activeSections: []
    });

    const firstColumn = pickNextColumn(session);
    res.json({
      success: true,
      sessionId: session._id,
      next: questionPayload(firstColumn),
      progress: { asked: 0, min: BASELINE_ORDER.length, max: MAX_QUESTIONS }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------
// POST /api/screening/:id/answer
// body: { column, value: "Yes" | "No" }
// ---------------------------------------------------------------------
router.post('/:id/answer', async (req, res) => {
  try {
    const { column, value } = req.body;
    if (!column || !['Yes', 'No'].includes(value)) {
      return res.status(400).json({ success: false, message: 'column and value ("Yes"/"No") are required' });
    }

    const session = await ScreeningSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status === 'completed') {
      return res.status(400).json({ success: false, message: 'This session is already complete' });
    }

    const q = BY_COLUMN[column];
    if (!q) return res.status(400).json({ success: false, message: 'Unknown question column' });
    if (session.askedColumns.includes(column)) {
      return res.status(400).json({ success: false, message: 'This question was already answered' });
    }

    // Record the answer
    session.answers.push({ column: q.column, section: q.section, question: q.text, value });
    session.askedColumns.push(column);

    const score = session.sectionScores[q.section] || { asked: 0, yes: 0, percentage: 0 };
    score.asked += 1;
    if (value === 'Yes') score.yes += 1;
    score.percentage = Math.round((score.yes / score.asked) * 100);
    session.sectionScores[q.section] = score;

    if (q.crisis && value === 'Yes') session.crisisFlag = true;

    // Only recompute which sections are "active" once the mixed baseline
    // is finished — that's when every section has been sampled at least once.
    if (session.askedColumns.length >= BASELINE_ORDER.length) {
      recomputeActiveSections(session);
    }

    const nextColumn = pickNextColumn(session);

    if (!nextColumn) {
      await completeSession(session);
      return res.json({
        success: true,
        done: true,
        crisisFlag: session.crisisFlag,
        results: session.aiResult,
        totalQuestions: session.askedColumns.length
      });
    }

    await session.save();
    res.json({
      success: true,
      done: false,
      crisisJustTriggered: !!(q.crisis && value === 'Yes'),
      next: questionPayload(nextColumn),
      progress: { asked: session.askedColumns.length, min: BASELINE_ORDER.length, max: MAX_QUESTIONS }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/screening/:id  — fetch a single session (for a results/review screen)
router.get('/:id', async (req, res) => {
  try {
    const session = await ScreeningSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/screening/history/me  — logged-in patient's past sessions
router.get('/history/me', requireAuth, async (req, res) => {
  try {
    const sessions = await ScreeningSession
      .find({ patient: req.user.id })
      .sort({ startedAt: -1 })
      .select('name status crisisFlag startedAt completedAt sectionScores aiResult');
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
