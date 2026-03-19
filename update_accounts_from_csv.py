import argparse
import csv
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import certifi
from dotenv import load_dotenv
from supabase import Client, create_client

try:
    import truststore
except ImportError:  # pragma: no cover
    truststore = None


load_dotenv()


def configure_tls() -> None:
    custom_ca_bundle = os.getenv("CUSTOM_CA_BUNDLE", "").strip()
    if custom_ca_bundle:
        os.environ["SSL_CERT_FILE"] = custom_ca_bundle
        os.environ["REQUESTS_CA_BUNDLE"] = custom_ca_bundle
        os.environ["CURL_CA_BUNDLE"] = custom_ca_bundle
        return

    if truststore is not None:
        try:
            truststore.inject_into_ssl()
            return
        except Exception:
            pass

    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
    os.environ.setdefault("CURL_CA_BUNDLE", certifi.where())


configure_tls()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
DEFAULT_REPORT_DIR = Path(os.getenv("REPORT_DIR", "Report"))


def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def find_latest_csv(report_dir: Path) -> Path:
    csv_files = sorted(report_dir.glob("agent_rd_report_*.csv"), key=lambda p: p.stat().st_mtime)
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {report_dir}")
    return csv_files[-1]


def parse_date_to_iso(value: str) -> Optional[str]:
    text = (value or "").strip()
    if not text:
        return None

    text = text.split()[0]

    month_map = {
        "jan": 1,
        "january": 1,
        "feb": 2,
        "february": 2,
        "mar": 3,
        "march": 3,
        "apr": 4,
        "april": 4,
        "may": 5,
        "jun": 6,
        "june": 6,
        "jul": 7,
        "july": 7,
        "aug": 8,
        "august": 8,
        "sep": 9,
        "sept": 9,
        "september": 9,
        "oct": 10,
        "october": 10,
        "nov": 11,
        "november": 11,
        "dec": 12,
        "december": 12,
    }

    name_match = re.match(r"^(\d{1,2})[-/ ]([A-Za-z]+)[-/ ](\d{2,4})$", text)
    if name_match:
        day = int(name_match.group(1))
        month_name = name_match.group(2).lower()
        year_value = int(name_match.group(3))
        month = month_map.get(month_name)
        if month is not None:
            if year_value < 100:
                year_value += 2000
            try:
                return datetime(year_value, month, day).date().isoformat()
            except ValueError:
                return None

    formats = [
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d-%m-%y",
        "%d/%m/%y",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_int(value: str) -> Optional[int]:
    text = (value or "").strip()
    if not text:
        return None

    match = re.search(r"-?\d+", text)
    if not match:
        return None
    return int(match.group(0))


def parse_float(value: str) -> Optional[float]:
    text = (value or "").strip().replace(",", "")
    if not text:
        return None

    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    return float(match.group(0))


def read_csv_records(csv_path: Path) -> List[Dict[str, str]]:
    with csv_path.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        return list(reader)


def sync_accounts_from_csv(csv_path: Path) -> Tuple[int, int, int]:
    supabase = get_supabase_client()
    rows = read_csv_records(csv_path)

    inserted_count = 0
    updated_count = 0
    skipped_count = 0

    for index, row in enumerate(rows, start=1):
        account_number = (row.get("Account Number") or "").strip()
        if not account_number:
            skipped_count += 1
            print(f"Row {index}: skipped (missing Account Number)")
            continue

        name = (row.get("Name") or "").strip()
        village = (row.get("Village") or "").strip()
        phone = (row.get("Mobile Number") or "").strip()
        emi_amount = parse_float(row.get("Monthly Emi", ""))
        emi_cycle = parse_int(row.get("Emi Cycle", ""))
        account_opening_date = parse_date_to_iso(row.get("Account Opening Date", ""))
        month_paid_upto = parse_int(row.get("Month Paid Upto", ""))
        next_emi_date = parse_date_to_iso(row.get("Next Emi Date", ""))

        existing = (
            supabase.table("accounts")
            .select("account_number")
            .eq("account_number", account_number)
            .limit(1)
            .execute()
        )

        if existing.data:
            update_data: Dict[str, object] = {}
            if month_paid_upto is not None:
                update_data["month_paid_upto"] = month_paid_upto
            update_data["next_emi_date"] = next_emi_date

            (
                supabase.table("accounts")
                .update(update_data)
                .eq("account_number", account_number)
                .execute()
            )
            updated_count += 1
            print(f"Row {index}: updated account {account_number}")
        else:
            insert_data: Dict[str, object] = {
                "account_number": account_number,
                "name": name,
                "village": village,
                "phone": phone,
                "month_paid_upto": month_paid_upto,
                "next_emi_date": next_emi_date,
            }
            if emi_amount is not None:
                insert_data["emi_amount"] = emi_amount
            if emi_cycle is not None:
                insert_data["emi_cycle"] = emi_cycle
            if account_opening_date is not None:
                insert_data["account_opening_date"] = account_opening_date

            supabase.table("accounts").insert(insert_data).execute()
            inserted_count += 1
            print(f"Row {index}: inserted account {account_number}")

    return inserted_count, updated_count, skipped_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Insert/update accounts from CSV into Supabase accounts table."
    )
    parser.add_argument(
        "--csv",
        dest="csv_path",
        type=str,
        default="",
        help="Path to CSV file. If omitted, latest Report/agent_rd_report_*.csv is used.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv_path) if args.csv_path else find_latest_csv(DEFAULT_REPORT_DIR)

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    print(f"Using CSV: {csv_path}")
    inserted, updated, skipped = sync_accounts_from_csv(csv_path)

    print("\n=== Database Stats ===")
    print(f"Records Inserted: {inserted}")
    print(f"Records Updated: {updated}")
    print(f"Records Skipped: {skipped}")
    print(f"Total Processed: {inserted + updated + skipped}")


if __name__ == "__main__":
    main()
