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


def get_medicines(disease, top_n=5):
    if disease == "Normal":
        return []
    matches = med_df[med_df["Target_Disorder"] == disease]
    return matches[["name", "Indication", "Side_Effects", "Habit Forming"]].head(top_n).to_dict("records")


@app.post("/predict")
async def predict(payload: ScreeningPayload):
    # Build the feature row in the exact column order the model was trained on.
    # Any symptom column not present in `answers` (not asked this session) defaults to 0.
    row = [payload.answers.get(col, 0) for col in symptom_columns]

    pred_idx = model.predict([row])[0]
    disease = le.inverse_transform([pred_idx])[0]
    confidence = float(max(model.predict_proba([row])[0]))

    return {
        "disease": disease,
        "confidence": round(confidence, 2),
        "medicine": get_medicines(disease),
        "disclaimer": "This is an automated screening suggestion, not a clinical diagnosis or prescription. Please consult a licensed psychiatrist."
    }
