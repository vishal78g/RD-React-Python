import csv
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv
from playwright.sync_api import Page
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


load_dotenv()


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
SUMMARY_TABLE_SELECTOR = os.getenv("SUMMARY_TABLE_SELECTOR", "#SummaryList")
PAGINATION_LABEL_XPATH = os.getenv("PAGINATION_LABEL_XPATH", "//*[@id='repeatDiv']/p/span/span[1]")
PREV_BUTTON_XPATH = os.getenv(
    "PREV_BUTTON_XPATH", "//*[@id='Action.AgentRDActSummaryAllListing.GOTO_PREV__']"
)
NEXT_BUTTON_XPATH = os.getenv(
    "NEXT_BUTTON_XPATH", "//*[@id='Action.AgentRDActSummaryAllListing.GOTO_NEXT__']"
)
TOTAL_COUNT_XPATH = os.getenv("TOTAL_COUNT_XPATH", "//*[@id='repeatDiv']/h2/span[3]/span")

REPORT_DIR = Path(os.getenv("REPORT_DIR", "Report"))


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
    page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=TIMEOUT_MS)
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
                "Account Name",
                "Month Paid Upto",
                "Next RD Installment Date",
            ],
        )
        writer.writeheader()
        writer.writerows(records)

    return output_file


def run() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS, slow_mo=SLOW_MO_MS)
        context = browser.new_context()
        page = context.new_page()
        page.set_default_timeout(TIMEOUT_MS)

        login_with_retry(page)
        page.wait_for_timeout(5000)
        print("Logged in successfully.")
        page.locator(f"xpath={ACCOUNTS_LINK_XPATH}").first.click()
        page.wait_for_timeout(5000)
        print("Navigated to Accounts section.")
        page.locator(f"xpath={AGENT_SCREEN_XPATH}").first.click()
        page.wait_for_timeout(10000)
        print("Navigated to Agent Enquire & Update Screen.")

        total_records = extract_total_count(page)
        print(f"Total records expected: {total_records}")

        all_records: List[Dict[str, str]] = []
        while len(all_records) < total_records:
            current_rows = extract_rows_from_current_page(page)

            for row in current_rows:
                if len(all_records) >= total_records:
                    break
                all_records.append(row)

            print(f"Collected {len(all_records)}/{total_records}")

            if len(all_records) >= total_records:
                break

            moved = goto_next_page(page)
            if not moved:
                break

        output_file = save_to_csv(all_records)
        print(f"Saved {len(all_records)} records to: {output_file}")

        context.close()
        browser.close()


if __name__ == "__main__":
    run()
