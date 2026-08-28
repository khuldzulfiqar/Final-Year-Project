import os
os.makedirs("saved_model", exist_ok=True)
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import classification_report, accuracy_score
import joblib

# 1. Load
df = pd.read_csv("data/Symptoms_dataset.csv")
X = df.drop(columns=["Patient_ID", "Diagnosis"])
y = df["Diagnosis"]

symptom_columns = list(X.columns)   # save exact order for later use in the API

le = LabelEncoder()
y_enc = le.fit_transform(y)

X_train, X_test, y_train, y_test = train_test_split(
    X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
)

# 2. Train + compare models
models = {
    "Random Forest": RandomForestClassifier(n_estimators=300, random_state=42),
    "Decision Tree": DecisionTreeClassifier(random_state=42),
    "Naive Bayes": GaussianNB(),
}

best_name, best_model, best_acc = None, None, 0
for name, clf in models.items():
    clf.fit(X_train, y_train)
    preds = clf.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print(f"\n=== {name} (accuracy: {acc:.3f}) ===")
    print(classification_report(y_test, preds, target_names=le.classes_))
    if acc > best_acc:
        best_name, best_model, best_acc = name, clf, acc

print(f"\nBest model: {best_name} ({best_acc:.3f})")

# 3. Save best model + encoder + column order
joblib.dump(best_model, "saved_model/disease_model.pkl")
joblib.dump(le, "saved_model/label_encoder.pkl")
joblib.dump(symptom_columns, "saved_model/symptom_columns.pkl")
print("Saved disease_model.pkl, label_encoder.pkl, symptom_columns.pkl")
