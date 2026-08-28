// Question bank for the adaptive symptom-screening engine.
// Mirrors Mental_Health_Symptom_Questionnaire.docx and its dataset
// column-mapping appendix (Yes -> 1, No -> 0).
//
// tier: "core"     -> part of the fixed, mixed baseline every session asks
//       "extended" -> only asked if the section gets triggered by the
//                     patient's core answers (adaptive branching)
// crisis: true      -> a "Yes" here sets session.crisisFlag immediately

const QUESTIONS = [
  // ---------------- Depression ----------------
  { section: "Depression", column: "low_mood", tier: "core",
    text: "Have you been feeling persistently sad, down, or low in mood?" },
  { section: "Depression", column: "loss_of_interest", tier: "core",
    text: "Have you lost interest or pleasure in activities you used to enjoy?" },
  { section: "Depression", column: "sleep_disturbance", tier: "core",
    text: "Do you have trouble sleeping, or are you sleeping much more/less than usual?" },
  { section: "Depression", column: "suicidal_thoughts", tier: "core", crisis: true,
    text: "Have you had any thoughts of harming yourself or that life is not worth living?" },
  { section: "Depression", column: "low_energy", tier: "extended",
    text: "Do you often feel low on energy or unusually tired, even without much physical activity?" },
  { section: "Depression", column: "feeling_of_worthless", tier: "extended",
    text: "Do you often feel worthless or that you are not good enough?" },
  { section: "Depression", column: "difficulty_concentrating", tier: "extended",
    text: "Do you find it hard to concentrate on tasks, reading, or conversations?" },
  { section: "Depression", column: "difficulty_functioning_in_daily_life", tier: "extended",
    text: "Do your symptoms make it hard for you to manage daily responsibilities (work, school, home)?" },
  { section: "Depression", column: "chronic_low_mood", tier: "extended",
    text: "Has your low mood lasted for most of the day, nearly every day, for two weeks or more?" },
  { section: "Depression", column: "withdrawal_from_social_life", tier: "extended",
    text: "Have you been withdrawing from friends, family, or social activities?" },
  { section: "Depression", column: "changes_in_weight", tier: "extended",
    text: "Have you noticed a significant change in your weight (gain or loss) recently?" },
  { section: "Depression", column: "poor_appetite", tier: "extended",
    text: "Have you had a reduced appetite or little interest in eating?" },
  { section: "Depression", column: "difficulty_making_decisions", tier: "extended",
    text: "Do you find it difficult to make even simple decisions?" },
  { section: "Depression", column: "recurrent_thoughts_of_death", tier: "extended", crisis: true,
    text: "Do you experience recurring thoughts about death or dying?" },
  { section: "Depression", column: "retardation", tier: "extended",
    text: "Have others noticed you moving, speaking, or reacting more slowly than usual?" },

  // ---------------- Anxiety ----------------
  { section: "Anxiety", column: "excessive_worry", tier: "core",
    text: "Do you worry excessively about everyday things, more than the situation calls for?" },
  { section: "Anxiety", column: "restlessness", tier: "core",
    text: "Do you often feel restless or on edge, unable to relax?" },
  { section: "Anxiety", column: "muscle_tension", tier: "core",
    text: "Do you frequently experience muscle tension or physical tightness in your body?" },
  { section: "Anxiety", column: "sudden_intense_fear", tier: "extended",
    text: "Have you had sudden episodes of intense fear or dread for no clear reason?" },
  { section: "Anxiety", column: "panic", tier: "extended",
    text: "Have you experienced sudden panic attacks?" },
  { section: "Anxiety", column: "sleep_disturbances", tier: "extended",
    text: "Do you have difficulty falling asleep or staying asleep due to worry?" },
  { section: "Anxiety", column: "irritability", tier: "extended",
    text: "Do you find yourself easily irritated or short-tempered?" },
  { section: "Anxiety", column: "significant_impairment_in_social_functioning", tier: "extended",
    text: "Has anxiety significantly affected your ability to function socially?" },
  { section: "Anxiety", column: "overthinking", tier: "extended",
    text: "Do you find yourself overthinking situations repeatedly?" },
  { section: "Anxiety", column: "rapid_heartbeat", tier: "extended",
    text: "Have you experienced episodes of a rapid or pounding heartbeat?" },
  { section: "Anxiety", column: "shortness_of_breath", tier: "extended",
    text: "Do you sometimes feel short of breath without physical exertion?" },

  // ---------------- Bipolar Disorder ----------------
  { section: "Bipolar Disorder", column: "irritable_mood", tier: "core",
    text: "Do you experience periods of unusually irritable or elevated mood?" },
  { section: "Bipolar Disorder", column: "increased_activity", tier: "core",
    text: "Have you had periods of unusually increased activity or energy, more than normal for you?" },
  { section: "Bipolar Disorder", column: "sadness", tier: "extended",
    text: "Do you experience periods of deep sadness that alternate with periods of high energy or elevated mood?" },
  { section: "Bipolar Disorder", column: "decreased_need_for_sleep", tier: "extended",
    text: "Have you had periods where you needed much less sleep than usual but still felt energetic?" },
  { section: "Bipolar Disorder", column: "rapid_speech", tier: "extended",
    text: "Do others notice you talking unusually fast or more than usual during certain periods?" },
  { section: "Bipolar Disorder", column: "impulsivity", tier: "extended",
    text: "Have you engaged in impulsive behaviors (spending, decisions) during high-energy periods?" },
  { section: "Bipolar Disorder", column: "loss_of_pleasure", tier: "extended",
    text: "During low periods, do you lose interest or pleasure in things you normally enjoy?" },
  { section: "Bipolar Disorder", column: "feeling_of_guilt", tier: "extended",
    text: "During low periods, do you experience strong feelings of guilt?" },

  // ---------------- Schizophrenia ----------------
  { section: "Schizophrenia", column: "hallucination", tier: "core",
    text: "Have you seen, heard, or sensed things that others say are not there?" },
  { section: "Schizophrenia", column: "delusion", tier: "core",
    text: "Have you held strong beliefs that others consider false or unrealistic, despite evidence against them?" },
  { section: "Schizophrenia", column: "hearing_voices", tier: "extended",
    text: "Have you heard voices that other people cannot hear?" },
  { section: "Schizophrenia", column: "disorganized_thinking", tier: "extended",
    text: "Do you find your thoughts becoming jumbled or difficult to organize?" },
  { section: "Schizophrenia", column: "unpredictable_behavior", tier: "extended",
    text: "Have others described your behavior as unpredictable or unusual?" },
  { section: "Schizophrenia", column: "social_withdrawal", tier: "extended",
    text: "Have you been withdrawing from social contact or isolating yourself?" },
  { section: "Schizophrenia", column: "flact_affect", tier: "extended",
    text: "Have others noticed your facial expressions or emotional responses seem reduced or flat?" },
  { section: "Schizophrenia", column: "inability_to_feel_pleasure", tier: "extended",
    text: "Do you find it hard to feel pleasure or enjoyment, even in activities you used to like?" }
];

const SECTION_ORDER = ["Depression", "Anxiety", "Bipolar Disorder", "Schizophrenia"];

// The fixed, interleaved baseline every session asks (mixes sections
// together rather than finishing one before starting the next).
const BASELINE_ORDER = [
  "low_mood",            // Depression
  "excessive_worry",     // Anxiety
  "irritable_mood",      // Bipolar Disorder
  "hallucination",       // Schizophrenia
  "loss_of_interest",    // Depression
  "restlessness",        // Anxiety
  "increased_activity",  // Bipolar Disorder
  "delusion",             // Schizophrenia
  "sleep_disturbance",    // Depression
  "muscle_tension",       // Anxiety
  "suicidal_thoughts"     // Depression (crisis check — always asked)
];

const MAX_QUESTIONS = 22; // hard cap; baseline (11) + up to 11 adaptive follow-ups
// (11 covers the largest single section's extended pool -- Depression has
// 11 extended questions -- so one strongly-triggered section can be fully
// explored instead of being cut off partway through.)

// Extended (follow-up) pool per section, in the order they get offered.
const EXTENDED_MAP = SECTION_ORDER.reduce((acc, section) => {
  acc[section] = QUESTIONS
    .filter(q => q.section === section && q.tier === "extended")
    .map(q => q.column);
  return acc;
}, {});

const BY_COLUMN = QUESTIONS.reduce((acc, q) => { acc[q.column] = q; return acc; }, {});

module.exports = { QUESTIONS, SECTION_ORDER, BASELINE_ORDER, MAX_QUESTIONS, EXTENDED_MAP, BY_COLUMN };
