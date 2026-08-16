const mongoose = require('mongoose');

// One answered question within a session.
const answerSchema = new mongoose.Schema({
  column:   { type: String, required: true },   // dataset column name, e.g. "low_mood"
  section:  { type: String, required: true },    // Depression | Anxiety | Bipolar Disorder | Schizophrenia
  question: { type: String, required: true },    // question text shown to the user (kept for audit/history)
  value:    { type: String, enum: ['Yes', 'No'], required: true }
}, { _id: false });

const sectionScoreSchema = new mongoose.Schema({
  asked:      { type: Number, default: 0 },  // how many questions from this section were asked
  yes:        { type: Number, default: 0 },  // how many were answered "Yes"
  percentage: { type: Number, default: 0 }   // yes / asked * 100, rounded
}, { _id: false });

const screeningSessionSchema = new mongoose.Schema({
  // Linked to a logged-in patient when available; sessions can also be
  // taken anonymously (guest screening) before registration.
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  name:   { type: String, required: true, trim: true },
  age:    { type: Number, required: true },
  gender: { type: String, required: true },

  answers: [answerSchema],

  // Which question column is queued up next (server is the source of truth
  // for the adaptive branching logic, not the client).
  askedColumns:   [{ type: String }],   // columns already shown, in order
  activeSections: [{ type: String }],   // sections currently "triggered" by positive answers

  sectionScores: {
    Depression:            { type: sectionScoreSchema, default: () => ({}) },
    Anxiety:                { type: sectionScoreSchema, default: () => ({}) },
    'Bipolar Disorder':     { type: sectionScoreSchema, default: () => ({}) },
    Schizophrenia:          { type: sectionScoreSchema, default: () => ({}) }
  },

  // Set immediately (and irreversibly) if a crisis question was answered "Yes".
  crisisFlag: { type: Boolean, default: false },

  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },

  // Result returned by the AI model (or the rule-based fallback scorer if
  // the model endpoint isn't configured yet). Left flexible since the
  // model's output shape may evolve.
  aiResult: { type: mongoose.Schema.Types.Mixed, default: null },

  startedAt:   { type: Date, default: Date.now },
  completedAt: { type: Date }
});

screeningSessionSchema.index({ patient: 1, startedAt: -1 });

const ScreeningSession = mongoose.models.ScreeningSession
  || mongoose.model('ScreeningSession', screeningSessionSchema);

module.exports = ScreeningSession;
