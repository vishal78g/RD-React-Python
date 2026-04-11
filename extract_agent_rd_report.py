import csv
import os
import re
import sys
import time
import tkinter as tk
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from tkinter import ttk

import certifi
from dotenv import load_dotenv
from playwright.sync_api import Page
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright
from supabase import create_client, Client


def get_runtime_base_path() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


BASE_DIR = get_runtime_base_path()
load_dotenv(BASE_DIR / ".env")

if getattr(sys, "frozen", False):
    _ms_playwright = Path(os.environ.get("LOCALAPPDATA", "")) / "ms-playwright"
    if _ms_playwright.exists():
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(_ms_playwright)

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
os.environ.setdefault("CURL_CA_BUNDLE", certifi.where())


LOGIN_URL = os.getenv("LOGIN_URL", "https://example.com/login")
USERNAME = os.getenv("LOGIN_USERNAME", "your-username")
PASSWORD = os.getenv("LOGIN_PASSWORD", "your-password")

USERNAME_SELECTOR = os.getenv("USERNAME_SELECTOR", "#username")
PASSWORD_SELECTOR = os.getenv("PASSWORD_SELECTOR", "#password")
SUBMIT_SELECTOR = os.getenv("SUBMIT_SELECTOR", "button[type='submit']")
CAPTCHA_IMAGE_SELECTOR = os.getenv("CAPTCHA_IMAGE_SELECTOR", "#IMAGECAPTCHA")
CAPTCHA_INPUT_SELECTOR = os.getenv("CAPTCHA_INPUT_SELECTOR", "input[name='captcha']")
SUCCESS_SELECTOR = os.getenv("SUCCESS_SELECTOR", "#logout, a[href*='logout'], text=Logout")

HEADLESS = os.getenv("HEADLESS", "false").lower() == "true"
SLOW_MO_MS = int(os.getenv("SLOW_MO_MS", "80"))
TIMEOUT_MS = int(os.getenv("TIMEOUT_MS", "30000"))
CAPTCHA_TARGET_LENGTH = int(os.getenv("CAPTCHA_TARGET_LENGTH", "6"))
CAPTCHA_POLL_INTERVAL_MS = int(os.getenv("CAPTCHA_POLL_INTERVAL_MS", "300"))
CAPTCHA_WAIT_TIMEOUT_MS = int(os.getenv("CAPTCHA_WAIT_TIMEOUT_MS", "180000"))
CAPTCHA_RETRY_TEXT = os.getenv(
    "CAPTCHA_RETRY_TEXT", "Enter the characters that you see in the picture"
)
CAPTCHA_MAX_ATTEMPTS = int(os.getenv("CAPTCHA_MAX_ATTEMPTS", "5"))

ACCOUNTS_LINK_XPATH = os.getenv("ACCOUNTS_LINK_XPATH", "//*[@id='Accounts']")
AGENT_SCREEN_XPATH = os.getenv(
    "AGENT_SCREEN_XPATH", "//*[@id='Agent Enquire & Update Screen']"
)
FETCH_MORE_ACCOUNTS = os.getenv(
    "FETCH_MORE_ACCOUNTS", "//*[@id='NEXT_ACCOUNTS']"
)
SUMMARY_TABLE_SELECTOR = os.getenv("SUMMARY_TABLE_SELECTOR", "#SummaryList")
PAGINATION_LABEL_XPATH = os.getenv("PAGINATION_LABEL_XPATH", "//*[@id='repeatDiv']/p/span/span[1]")
PREV_BUTTON_XPATH = os.getenv(
    "PREV_BUTTON_XPATH", "//*[@id='Action.AgentRDActSummaryAllListing.GOTO_PREV__']"
)
NEXT_BUTTON_XPATH = os.getenv(
    "NEXT_BUTTON_XPATH", "//*[@id='Action.AgentRDActSummaryAllListing.GOTO_NEXT__']"
)
TOTAL_COUNT_XPATH = os.getenv("TOTAL_COUNT_XPATH", "//*[@id='repeatDiv']/h2/span[3]/span")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

DETAIL_ACCOUNT_NUMBER_XPATH = os.getenv(
    "DETAIL_ACCOUNT_NUMBER_XPATH", "//*[@id='HREF_CustomAgentRDAccountFG.ACCOUNT_NUMBER']"
)
DETAIL_NAME_XPATH = os.getenv(
    "DETAIL_NAME_XPATH", "//*[@id='HREF_CustomAgentRDAccountFG.ACCOUNT_NICKNAME']"
)
DETAIL_ACCOUNT_OPENING_DATE_XPATH = os.getenv(
    "DETAIL_ACCOUNT_OPENING_DATE_XPATH",
    "//*[@id='HREF_CustomAgentRDAccountFG.RD_ACCOUNT_OPEN_DATE']",
)
DETAIL_MONTHLY_EMI_XPATH = os.getenv(
    "DETAIL_MONTHLY_EMI_XPATH", "//*[@id='HREF_CustomAgentRDAccountFG.RD_DESPOSIT_AMOUNT']"
)
DETAIL_MONTH_PAID_UPTO_XPATH = os.getenv(
    "DETAIL_MONTH_PAID_UPTO_XPATH", "//*[@id='HREF_CustomAgentRDAccountFG.MONTH_PAID_UPTO_BASIC']"
)
DETAIL_NEXT_EMI_DATE_XPATH = os.getenv(
    "DETAIL_NEXT_EMI_DATE_XPATH", "//*[@id='HREF_CustomAgentRDAccountFG.NEXT_RD_INSTALLMENT_DATE']"
)
BACK_BUTTON_XPATH = os.getenv("BACK_BUTTON_XPATH", "//*[@id='backButton']")

REPORT_DIR = Path(os.getenv("REPORT_DIR", "Report"))


class ExtractionProgressWindow:
    def __init__(self) -> None:
        self.enabled = False
        self.value = 0
        try:
            self.root = tk.Tk()
            self.root.title("RD Extract Progress")
            self.root.geometry("520x140")
            self.root.resizable(False, False)

            frame = ttk.Frame(self.root, padding=16)
            frame.pack(fill="both", expand=True)

            self.status_var = tk.StringVar(value="Starting...")
            ttk.Label(frame, textvariable=self.status_var).pack(anchor="w")

            self.progress_var = tk.DoubleVar(value=0)
            self.progress_bar = ttk.Progressbar(
                frame,
                orient="horizontal",
                mode="determinate",
                maximum=100,
                variable=self.progress_var,
                length=480,
            )
            self.progress_bar.pack(pady=12)

            self.percent_var = tk.StringVar(value="0%")
            ttk.Label(frame, textvariable=self.percent_var).pack(anchor="e")

            self.enabled = True
            self._refresh()
        except Exception:
            self.enabled = False

    def _refresh(self) -> None:
        if not self.enabled:
            return
        self.root.update_idletasks()
        self.root.update()

    def set_status(self, text: str) -> None:
        if not self.enabled:
            return
        self.status_var.set(text)
        self._refresh()

    def set_total(self, total: int) -> None:
        if not self.enabled:
            return
        max_value = max(total, 1)
        self.progress_bar.configure(maximum=max_value)
        self.progress_var.set(0)
        self.percent_var.set("0%")
        self.value = 0
        self._refresh()

    def advance(self, step: int = 1) -> None:
        if not self.enabled:
            return
        self.value += step
        self.progress_var.set(self.value)
        maximum = float(self.progress_bar.cget("maximum"))
        percent = int((self.value / maximum) * 100) if maximum else 0
        self.percent_var.set(f"{min(percent, 100)}%")
        self._refresh()

    def close(self) -> None:
        if not self.enabled:
            return
        try:
            self.root.destroy()
        except Exception:
            pass


def wait_for_captcha_length(page: Page) -> bool:
    if page.locator(CAPTCHA_IMAGE_SELECTOR).count() > 0:
        print("CAPTCHA detected. Solve it manually in browser.")
        if page.locator(CAPTCHA_INPUT_SELECTOR).count() > 0:
            captcha_input = page.locator(CAPTCHA_INPUT_SELECTOR).first
            print(
                f"Waiting for CAPTCHA input length to become {CAPTCHA_TARGET_LENGTH}..."
            )

            elapsed_ms = 0
            while elapsed_ms < CAPTCHA_WAIT_TIMEOUT_MS:
                captcha_value = captcha_input.input_value().strip()
                if len(captcha_value) == CAPTCHA_TARGET_LENGTH:
                    return True

                page.wait_for_timeout(CAPTCHA_POLL_INTERVAL_MS)
                elapsed_ms += CAPTCHA_POLL_INTERVAL_MS

            print("Timed out waiting for CAPTCHA target length.")
            return False

        print("CAPTCHA input selector not found. Solve CAPTCHA manually and press Enter.")
        input()

    return True


def click_submit(page: Page) -> None:
    page.locator(SUBMIT_SELECTOR).first.click()


def login_with_retry(page: Page) -> None:
    page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=60000)
    page.locator(USERNAME_SELECTOR).first.fill(USERNAME)
    page.locator(PASSWORD_SELECTOR).first.fill(PASSWORD)

    login_success = False
    for attempt in range(1, CAPTCHA_MAX_ATTEMPTS + 1):
        print(f"Login attempt {attempt}/{CAPTCHA_MAX_ATTEMPTS}")

        captcha_ready = wait_for_captcha_length(page)
        if not captcha_ready:
            raise RuntimeError("CAPTCHA was not entered in configured timeout.")

        click_submit(page)

        try:
            page.locator(SUCCESS_SELECTOR).first.wait_for(state="visible", timeout=10000)
            print("Login successful.")
            login_success = True
            break
        except PlaywrightTimeoutError:
            retry_message_visible = False
            try:
                page.get_by_text(CAPTCHA_RETRY_TEXT).first.wait_for(state="visible", timeout=4000)
                retry_message_visible = True
            except PlaywrightTimeoutError:
                retry_message_visible = False

            if retry_message_visible:
                print("CAPTCHA failed. Waiting for fresh CAPTCHA and then refilling password.")
                captcha_ready = wait_for_captcha_length(page)
                if not captcha_ready:
                    raise RuntimeError("CAPTCHA was not re-entered in configured timeout.")
                page.locator(PASSWORD_SELECTOR).first.fill(PASSWORD)
                click_submit(page)
                try:
                    page.locator(SUCCESS_SELECTOR).first.wait_for(state="visible", timeout=10000)
                    print("Login successful.")
                    login_success = True
                    break
                except PlaywrightTimeoutError:
                    continue

            print("Unable to confirm login success. Check selectors.")
            break

    if not login_success:
        raise RuntimeError("Login failed after configured attempts.")


def click_link_by_id_or_text(page: Page, value: str) -> None:
    candidates = [
        page.locator(f"a#{value}").first,
        page.locator(f"a[id='{value}']").first,
        page.get_by_role("link", name=value).first,
        page.get_by_text(value).first,
    ]

    last_error = None
    for locator in candidates:
        try:
            locator.wait_for(state="visible", timeout=3000)
            locator.click()
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue

    raise RuntimeError(f"Could not click link using value '{value}'.") from last_error


def extract_total_count(page: Page) -> int:
    text = page.locator(f"xpath={TOTAL_COUNT_XPATH}").first.inner_text().strip()
    normalized = text.replace(",", "")
    match = re.search(r"\bof\s+(\d+)\b", normalized, flags=re.IGNORECASE)
    if not match:
        numbers = re.findall(r"\d+", normalized)
        if numbers:
            return int(numbers[-1])
    if not match:
        raise RuntimeError(f"Unable to parse total count from: {text}")
    return int(match.group(1))


def extract_rows_from_current_page(page: Page) -> List[Dict[str, str]]:
    page.locator(SUMMARY_TABLE_SELECTOR).first.wait_for(state="visible", timeout=15000)
    rows = page.locator(f"{SUMMARY_TABLE_SELECTOR} tr")
    row_count = rows.count()

    extracted: List[Dict[str, str]] = []
    for index in range(row_count):
        row = rows.nth(index)
        cells = row.locator("td")
        if cells.count() < 6:
            continue

        account_number = cells.nth(1).inner_text().strip()
        account_name = cells.nth(2).inner_text().strip()
        month_paid_upto = cells.nth(4).inner_text().strip()
        next_rd_installment_date = cells.nth(5).inner_text().strip()

        if not account_number:
            continue

        extracted.append(
            {
                "Account Number": account_number,
                "Account Name": account_name,
                "Month Paid Upto": month_paid_upto,
                "Next RD Installment Date": next_rd_installment_date,
            }
        )

    return extracted


def create_summary_only_record(summary_row: Dict[str, str]) -> Dict[str, str]:
    """Create a record with only summary data (for existing accounts)."""
    return {
        "Account Number": summary_row["Account Number"],
        "Name": summary_row["Account Name"],
        "Account Opening Date": "",
        "Monthly Emi": "",
        "Month Paid Upto": summary_row["Month Paid Upto"],
        "Next Emi Date": summary_row["Next RD Installment Date"],
        "Village": "",
        "Mobile Number": "0",
        "Emi Cycle": "",
    }



def extract_account_numbers_from_current_page(page: Page) -> List[str]:
    page.locator(SUMMARY_TABLE_SELECTOR).first.wait_for(state="visible", timeout=15000)
    rows = page.locator(f"{SUMMARY_TABLE_SELECTOR} tr")
    row_count = rows.count()

    account_numbers: List[str] = []
    for index in range(row_count):
        row = rows.nth(index)
        cells = row.locator("td")
        if cells.count() < 2:
            continue

        account_number = cells.nth(1).inner_text().strip()
        if account_number:
            account_numbers.append(account_number)

    return account_numbers


def read_text_from_xpath(page: Page, xpath: str, timeout: int = 15000) -> str:
    locator = page.locator(f"xpath={xpath}").first
    locator.wait_for(state="visible", timeout=timeout)
    return locator.inner_text().strip()


def compute_emi_cycle(account_opening_date: str) -> str:
    supported_formats = [
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d-%m-%y",
        "%d/%m/%y",
        "%Y-%m-%d",
    ]

    for date_format in supported_formats:
        try:
            day = datetime.strptime(account_opening_date, date_format).day
            return "15" if day <= 15 else "30"
        except ValueError:
            continue

    match = re.search(r"\b(\d{1,2})\b", account_opening_date)
    if match:
        day = int(match.group(1))
        return "15" if day <= 15 else "30"

    return ""


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

    for date_format in formats:
        try:
            return datetime.strptime(text, date_format).date().isoformat()
        except ValueError:
            continue

    return None


def open_account_details(page: Page, account_number: str) -> None:
    link_locator = page.locator(
        f"{SUMMARY_TABLE_SELECTOR} a:has-text('{account_number}')"
    ).first

    link_locator.wait_for(state="visible", timeout=10000)
    link_locator.click()
    page.locator(f"xpath={DETAIL_ACCOUNT_NUMBER_XPATH}").first.wait_for(
        state="visible", timeout=15000
    )


def capture_account_details(page: Page) -> Dict[str, str]:
    account_number = read_text_from_xpath(page, DETAIL_ACCOUNT_NUMBER_XPATH)
    name = read_text_from_xpath(page, DETAIL_NAME_XPATH)
    account_opening_date = read_text_from_xpath(page, DETAIL_ACCOUNT_OPENING_DATE_XPATH)
    monthly_emi = read_text_from_xpath(page, DETAIL_MONTHLY_EMI_XPATH)
    month_paid_upto = read_text_from_xpath(page, DETAIL_MONTH_PAID_UPTO_XPATH)
    next_emi_date = read_text_from_xpath(page, DETAIL_NEXT_EMI_DATE_XPATH)

    return {
        "Account Number": account_number,
        "Name": name,
        "Account Opening Date": account_opening_date,
        "Monthly Emi": monthly_emi,
        "Month Paid Upto": month_paid_upto,
        "Next Emi Date": next_emi_date,
        "Village": "",
        "Mobile Number": "0",
        "Emi Cycle": compute_emi_cycle(account_opening_date),
    }


def return_to_summary_from_details(page: Page) -> None:
    page.locator(f"xpath={BACK_BUTTON_XPATH}").first.click()
    page.locator(SUMMARY_TABLE_SELECTOR).first.wait_for(state="visible", timeout=15000)


def can_go_next(page: Page) -> bool:
    next_button = page.locator(f"xpath={NEXT_BUTTON_XPATH}").first
    if next_button.count() == 0:
        return False

    classes = next_button.get_attribute("class") or ""
    disabled_attr = next_button.get_attribute("disabled")

    return disabled_attr is None and "disabled" not in classes.lower()


def goto_next_page(page: Page) -> bool:
    if not can_go_next(page):
        return False

    current_marker = page.locator(f"xpath={PAGINATION_LABEL_XPATH}").first.inner_text().strip()
    page.locator(f"xpath={NEXT_BUTTON_XPATH}").first.click()

    start = time.time()
    while time.time() - start < 15:
        try:
            updated_marker = page.locator(f"xpath={PAGINATION_LABEL_XPATH}").first.inner_text().strip()
            if updated_marker and updated_marker != current_marker:
                return True
        except Exception:  # noqa: BLE001
            pass
        page.wait_for_timeout(400)

    return True


def save_to_csv(records: List[Dict[str, str]]) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = REPORT_DIR / f"agent_rd_report_{timestamp}.csv"

    with output_file.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=[
                "Account Number",
                "Name",
                "Account Opening Date",
                "Monthly Emi",
                "Month Paid Upto",
                "Next Emi Date",
                "Village",
                "Mobile Number",
                "Emi Cycle",
            ],
        )
        writer.writeheader()
        writer.writerows(records)

    return output_file


def chunked_records(items: List[Dict[str, object]], size: int) -> List[List[Dict[str, object]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def chunked_strings(items: List[str], size: int) -> List[List[str]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def fetch_existing_account_numbers() -> set:
    """Fetch all existing account numbers from the database."""
    try:
        supabase = get_supabase_client()
        response = supabase.table("accounts").select("account_number").execute()
        account_numbers = {record["account_number"] for record in response.data or []}
        print(f"Fetched {len(account_numbers)} existing account numbers from database.")
        return account_numbers
    except Exception as e:
        print(f"Warning: Failed to fetch existing accounts: {e}")
        return set()


def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file"
        )
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def upsert_to_database(records: List[Dict[str, str]]) -> tuple[int, int]:
    supabase = get_supabase_client()
    batch_size = 500
    normalized_records: List[Dict[str, object]] = []

    for record in records:
        account_number = record["Account Number"]
        account_opening_date = parse_date_to_iso(record.get("Account Opening Date", ""))
        month_paid_upto_text = record.get("Month Paid Upto", "")
        try:
            month_paid_upto = int((month_paid_upto_text or "").strip())
        except ValueError:
            month_paid_upto = None

        monthly_emi_text = (record.get("Monthly Emi", "") or "").strip().replace(",", "")
        try:
            emi_amount = float(monthly_emi_text) if monthly_emi_text else None
        except ValueError:
            emi_amount = None

        emi_cycle_text = (record.get("Emi Cycle", "") or "").strip()
        try:
            emi_cycle = int(emi_cycle_text) if emi_cycle_text else None
        except ValueError:
            emi_cycle = None

        normalized_records.append(
            {
                "account_number": account_number,
                "name": record.get("Name", ""),
                "village": record.get("Village", ""),
                "phone": record.get("Mobile Number", ""),
                "emi_amount": emi_amount,
                "emi_cycle": emi_cycle,
                "account_opening_date": account_opening_date,
                "month_paid_upto": month_paid_upto,
                "next_emi_date": parse_date_to_iso(record.get("Next Emi Date", "")),
            }
        )

    account_numbers = [str(item["account_number"]) for item in normalized_records]
    extracted_account_numbers_set = set(account_numbers)
    existing_records: Dict[str, Dict[str, object]] = {}

    for number_chunk in chunked_strings(account_numbers, batch_size):
        response = (
            supabase.table("accounts")
            .select(
                "account_number,name,village,phone,emi_amount,emi_cycle,account_opening_date,month_paid_upto,next_emi_date"
            )
            .in_("account_number", number_chunk)
            .execute()
        )
        for existing_record in response.data or []:
            value = existing_record.get("account_number")
            if value:
                existing_records[value] = existing_record

    update_rows: List[Dict[str, object]] = []
    insert_rows: List[Dict[str, object]] = []

    for item in normalized_records:
        account_number = str(item["account_number"])
        if account_number in existing_records:
            existing_record = existing_records[account_number]
            update_payload: Dict[str, object] = {
                "account_number": account_number,
                "name": existing_record.get("name"),
                "village": existing_record.get("village"),
                "phone": existing_record.get("phone"),
                "emi_amount": existing_record.get("emi_amount"),
                "emi_cycle": existing_record.get("emi_cycle"),
                "account_opening_date": existing_record.get("account_opening_date"),
                "month_paid_upto": existing_record.get("month_paid_upto"),
                "next_emi_date": item["next_emi_date"],
                "active_status": True,
            }
            if item["month_paid_upto"] is not None:
                update_payload["month_paid_upto"] = item["month_paid_upto"]
            update_rows.append(update_payload)
            continue

        insert_payload: Dict[str, object] = {
            "account_number": account_number,
            "name": item["name"],
            "village": item["village"],
            "phone": item["phone"],
            "month_paid_upto": item["month_paid_upto"],
            "next_emi_date": item["next_emi_date"],
            "active_status": True,
        }
        if item["emi_amount"] is not None:
            insert_payload["emi_amount"] = item["emi_amount"]
        if item["emi_cycle"] is not None:
            insert_payload["emi_cycle"] = item["emi_cycle"]
        if item["account_opening_date"] is not None:
            insert_payload["account_opening_date"] = item["account_opening_date"]
        insert_rows.append(insert_payload)

    for update_chunk in chunked_records(update_rows, batch_size):
        supabase.table("accounts").upsert(update_chunk, on_conflict="account_number").execute()

    for insert_chunk in chunked_records(insert_rows, batch_size):
        supabase.table("accounts").insert(insert_chunk).execute()

    print("Updating inactive status for accounts not in current extraction...")
    update_inactive_status(extracted_account_numbers_set)

    return len(insert_rows), len(update_rows)


def update_inactive_status(extracted_account_numbers: set) -> None:
    """Set active_status to False for accounts not found in current extraction."""
    supabase = get_supabase_client()
    batch_size = 500

    try:
        # Fetch ALL accounts from database
        all_accounts_response = supabase.table("accounts").select("account_number").execute()
        all_db_accounts = [record["account_number"] for record in all_accounts_response.data or []]

        # Find accounts that are NOT in extracted data
        accounts_to_deactivate = [acc for acc in all_db_accounts if acc not in extracted_account_numbers]

        if not accounts_to_deactivate:
            print(f"No accounts to deactivate. All {len(all_db_accounts)} DB accounts are in current extraction.")
            return

        print(f"Found {len(accounts_to_deactivate)} accounts not in current extraction. Setting active_status to False...")

        # Update active_status to False in batches
        for account_chunk in chunked_strings(accounts_to_deactivate, batch_size):
            # Fetch existing records for this chunk
            response = (
                supabase.table("accounts")
                .select("account_number,name,village,phone,emi_amount,emi_cycle,account_opening_date,month_paid_upto,next_emi_date")
                .in_("account_number", account_chunk)
                .execute()
            )

            # Build update payload with active_status = False
            update_payloads = []
            for record in response.data or []:
                update_payloads.append({
                    "account_number": record["account_number"],
                    "name": record.get("name"),
                    "village": record.get("village"),
                    "phone": record.get("phone"),
                    "emi_amount": record.get("emi_amount"),
                    "emi_cycle": record.get("emi_cycle"),
                    "account_opening_date": record.get("account_opening_date"),
                    "month_paid_upto": record.get("month_paid_upto"),
                    "next_emi_date": record.get("next_emi_date"),
                    "active_status": False,
                })

            if update_payloads:
                supabase.table("accounts").upsert(update_payloads, on_conflict="account_number").execute()

        print(f"Successfully deactivated {len(accounts_to_deactivate)} accounts.")
    except Exception as e:
        print(f"Warning: Failed to update inactive status: {e}")



def run() -> None:
    progress_window = ExtractionProgressWindow()
    progress_window.set_status("Launching browser...")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=HEADLESS, slow_mo=SLOW_MO_MS)
            context = browser.new_context()
            page = context.new_page()
            page.set_default_timeout(TIMEOUT_MS)

            progress_window.set_status("Waiting for login and CAPTCHA...")
            login_with_retry(page)
            page.wait_for_timeout(5000)
            print("Logged in successfully.")
            page.locator(f"xpath={ACCOUNTS_LINK_XPATH}").first.click()
            page.wait_for_timeout(5000)
            print("Navigated to Accounts section.")
            page.locator(f"xpath={AGENT_SCREEN_XPATH}").first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            page.locator(f"xpath={FETCH_MORE_ACCOUNTS}").first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            print("Navigated to Agent Enquire & Update Screen.")

            progress_window.set_status("Fetching existing account numbers from database...")
            existing_accounts = fetch_existing_account_numbers()
            print(f"\nFound {len(existing_accounts)} existing accounts in database.")

            total_records = extract_total_count(page)
            print(f"Total records expected: {total_records}")

            all_records: List[Dict[str, str]] = []
            new_accounts: List[str] = []
            updated_accounts: List[str] = []
            processed_accounts = set()
            progress_window.set_total(total_records)
            progress_window.set_status("Extracting account details...")

            while len(processed_accounts) < total_records:
                summary_rows = extract_rows_from_current_page(page)

                for summary_row in summary_rows:
                    account_number = summary_row["Account Number"]
                    
                    if len(processed_accounts) >= total_records:
                        break
                    if account_number in processed_accounts:
                        continue

                    if account_number in existing_accounts:
                        # Existing account: only update Month Paid Upto and Next RD Installment Due Date
                        summary_record = create_summary_only_record(summary_row)
                        all_records.append(summary_record)
                        updated_accounts.append(account_number)
                        processed_accounts.add(account_number)
                        progress_window.advance(1)
                        progress_window.set_status(
                            f"Extracting account details... {len(processed_accounts)}/{total_records} "
                            f"(New: {len(new_accounts)}, Updated: {len(updated_accounts)})"
                        )
                    else:
                        # New account: extract full details from detail page
                        open_account_details(page, account_number)
                        account_data = capture_account_details(page)
                        all_records.append(account_data)
                        new_accounts.append(account_number)
                        processed_accounts.add(account_data["Account Number"])
                        return_to_summary_from_details(page)

                        progress_window.advance(1)
                        progress_window.set_status(
                            f"Extracting account details... {len(processed_accounts)}/{total_records} "
                            f"(New: {len(new_accounts)}, Updated: {len(updated_accounts)})"
                        )

                if len(processed_accounts) >= total_records:
                    break

                moved = goto_next_page(page)
                if not moved:
                    break

            progress_window.set_status("Saving CSV file...")
            output_file = save_to_csv(all_records)
            print(f"Saved {len(all_records)} records to CSV: {output_file}")

            progress_window.set_status("Updating database...")
            print("\nPushing records to Supabase database...")
            inserted, updated = upsert_to_database(all_records)
            print(f"\n=== Database Stats ===")
            print(f"New Accounts Inserted: {inserted}")
            print(f"Existing Accounts Updated: {updated}")
            print(f"Total Processed: {len(all_records)}")
            print(f"\nBreakdown:")
            print(f"  - New accounts extracted & inserted: {len(new_accounts)}")
            print(f"  - Existing accounts updated (summary only): {len(updated_accounts)}")
            print(f"\nActive Status:")
            print(f"  - Accounts marked ACTIVE (present in extraction): {len(new_accounts) + len(updated_accounts)}")
            print(f"  - Accounts marked INACTIVE (not in extraction): See console output above")

            progress_window.set_status("Completed successfully.")
            context.close()
            browser.close()
    finally:
        progress_window.close()



if __name__ == "__main__":
    run()
