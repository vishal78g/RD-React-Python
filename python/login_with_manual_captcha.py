import os
from dotenv import load_dotenv
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


def wait_for_captcha_length(page) -> bool:
    if page.locator(CAPTCHA_IMAGE_SELECTOR).count() > 0:
        print("CAPTCHA detected. Solve it manually in the browser window.")
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
        else:
            print("No CAPTCHA input selector configured. Solve CAPTCHA and press Enter to continue.")
            input()
            return True

    return True


def wait_for_captcha_and_submit(page) -> None:
    if wait_for_captcha_length(page):
        page.locator(SUBMIT_SELECTOR).click()
        print("Submit clicked.")
    else:
        print("Proceeding with manual submit. Press Enter to continue.")
        input()
        page.locator(SUBMIT_SELECTOR).click()



def run() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS, slow_mo=SLOW_MO_MS)
        context = browser.new_context()
        page = context.new_page()
        page.set_default_timeout(TIMEOUT_MS)

        page.goto(LOGIN_URL, wait_until="domcontentloaded" , timeout=30000)
        page.locator(USERNAME_SELECTOR).fill(USERNAME)
        page.locator(PASSWORD_SELECTOR).fill(PASSWORD)
        page.wait_for_timeout(10000)

        login_success = False
        for attempt in range(1, CAPTCHA_MAX_ATTEMPTS + 1):
            print(f"Login attempt {attempt}/{CAPTCHA_MAX_ATTEMPTS}")
            wait_for_captcha_and_submit(page)

            try:
                page.locator(SUCCESS_SELECTOR).first.wait_for(state="visible", timeout=10000)
                print("Login appears successful.")
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
                    print(
                        "CAPTCHA was incorrect. Waiting for CAPTCHA length, then refilling password before retry submit."
                    )
                    captcha_ready = wait_for_captcha_length(page)
                    if not captcha_ready:
                        print("CAPTCHA was not ready in time. Stopping retries.")
                        break

                    page.locator(PASSWORD_SELECTOR).fill(PASSWORD)
                    continue

                print("Login state could not be confirmed with SUCCESS_SELECTOR. Update selectors if needed.")
                break

        if not login_success:
            print("Login was not successful after configured attempts.")

        page.wait_for_timeout(50000)
        context.close()
        browser.close()


if __name__ == "__main__":
    run()
