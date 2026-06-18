import argparse
import csv

from sqlalchemy.orm import Session

from app.core.database import engine
from app.models import DatasetSample
from app.schemas.api import CATEGORIES


def import_csv(path: str) -> None:
    with open(path, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    with Session(engine) as db:
        for row in rows:
            category = row["ground_truth_category"].strip()
            if category not in CATEGORIES:
                raise ValueError(f"Unsupported category: {category}")
            db.add(
                DatasetSample(
                    text=row["text"].strip(),
                    context=row.get("context", "").strip(),
                    ground_truth_category=category,
                )
            )
        db.commit()
    print(f"Imported {len(rows)} dataset samples")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    import_csv(parser.parse_args().csv_path)
