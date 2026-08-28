import pandas as pd

def build_medicine_lookup(csv_path="data/medicines_dataset.csv"):
    med = pd.read_csv(csv_path)
    # Split multi-disorder rows: "Anxiety, Depression" -> two rows, one per disorder
    med["Target_Disorder"] = med["Target_Disorder"].str.split(",")
    med = med.explode("Target_Disorder")
    med["Target_Disorder"] = med["Target_Disorder"].str.strip()
    return med

def get_medicines(disease, med_df, top_n=5):
    if disease == "Normal":
        return []
    matches = med_df[med_df["Target_Disorder"] == disease]
    return matches[["name", "Indication", "Side_Effects", "Habit Forming"]].head(top_n).to_dict("records")

if __name__ == "__main__":
    med_df = build_medicine_lookup("/mnt/user-data/uploads/medicines_dataset.csv")
    print(med_df["Target_Disorder"].value_counts())
    print()
    print(get_medicines("Depression", med_df, top_n=3))
