from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd

app = FastAPI()

model = joblib.load("saved_model/disease_model.pkl")
le = joblib.load("saved_model/label_encoder.pkl")
symptom_columns = joblib.load("saved_model/symptom_columns.pkl")

med_df = pd.read_csv("data/medicines_dataset.csv")
med_df["Target_Disorder"] = med_df["Target_Disorder"].str.split(",")
med_df = med_df.explode("Target_Disorder")
med_df["Target_Disorder"] = med_df["Target_Disorder"].str.strip()


class ScreeningPayload(BaseModel):
    name: str
    age: int
    gender: str
    answers: dict  # { "low_mood": 1, "excessive_worry": 0, ... }


# ---------------------------------------------------------------------
# Guidance content, keyed to the exact 5 labels the model can predict
# (Depression, Anxiety, Bipolar, Schizophrenia, Normal — confirmed from
# Symptoms_dataset.csv's Diagnosis column), so it always stays in sync
# with whatever the model actually outputs.
# ---------------------------------------------------------------------
GUIDANCE = {
    "Depression": {
        "selfCare": [
            "Try to keep a consistent sleep and wake time, even on hard days.",
            "Break tasks into small steps — finishing one small thing counts.",
            "Reach out to one trusted person this week, even briefly."
        ],
        "recommendedAction": "Book a consultation with a psychiatrist specializing in Depression.",
        "urgency": "moderate"
    },
    "Anxiety": {
        "selfCare": [
            "Practice slow breathing (4 seconds in, 6 seconds out) when worry spikes.",
            "Limit caffeine, which can worsen restlessness and racing thoughts.",
            "Write worries down instead of replaying them mentally."
        ],
        "recommendedAction": "Book a consultation with a psychiatrist specializing in Anxiety.",
        "urgency": "moderate"
    },
    "Bipolar": {
        "selfCare": [
            "Track your mood daily — sudden energy/sleep changes are important signals.",
            "Keep a stable daily routine; irregular sleep can trigger mood shifts.",
            "Avoid major financial or life decisions during high-energy periods."
        ],
        "recommendedAction": "See a psychiatrist specializing in Bipolar Disorder soon for a proper evaluation.",
        "urgency": "high"
    },
    "Schizophrenia": {
        "selfCare": [
            "Note down what you experience and when, to share with a professional.",
            "Stay connected to someone you trust — isolation can worsen symptoms.",
            "Avoid alcohol or recreational drugs, which can intensify symptoms."
        ],
        "recommendedAction": "This pattern needs prompt evaluation — please book a psychiatrist appointment soon.",
        "urgency": "high"
    },
    "Normal": {
        "selfCare": [
            "Your answers don't show strong signs of the screened conditions right now — keep monitoring how you feel."
        ],
        "recommendedAction": "No urgent action needed. Retake the screening if things change.",
        "urgency": "low"
    }
}


def get_medicines(disease, top_n=5):
    if disease == "Normal":
        return []
    matches = med_df[med_df["Target_Disorder"] == disease].head(top_n)
    result = []
    for _, row in matches.iterrows():
        substitutes_raw = row.get("Substitutes", "")
        substitutes = [s.strip() for s in str(substitutes_raw).split(",") if s.strip() and s.strip().lower() != "nan"]
        result.append({
            "name": row["name"],
            "indication": row["Indication"],
            "sideEffects": row["Side_Effects"],
            "substitutes": substitutes,
            "therapeuticClass": row.get("Therapeutic Class", ""),
            "habitForming": str(row.get("Habit Forming", "No")).strip().lower() == "yes"
        })
    return result


@app.post("/predict")
async def predict(payload: ScreeningPayload):
    # Build the feature row in the exact column order the model was trained on.
    # Any symptom column not present in `answers` (not asked this session) defaults to 0.
    row = [payload.answers.get(col, 0) for col in symptom_columns]

    pred_idx = model.predict([row])[0]
    disease = le.inverse_transform([pred_idx])[0]
    confidence = float(max(model.predict_proba([row])[0]))
    medicines = get_medicines(disease)

    return {
        "disease": disease,
        "confidence": round(confidence, 2),
        "medicine": medicines,
        "guidance": GUIDANCE.get(disease, GUIDANCE["Normal"]),
        "habitFormingWarning": any(m["habitForming"] for m in medicines),
        "disclaimer": "This is an automated screening suggestion, not a clinical diagnosis or prescription. Please consult a licensed psychiatrist."
    }
