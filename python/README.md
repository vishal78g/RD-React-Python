# Playwright login with manual CAPTCHA step

This project automates login form filling with Python Playwright and keeps CAPTCHA solving manual.

## 1) Install dependencies in your virtual environment

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m playwright install
```

## 2) Set your login details and selectors (PowerShell example)

```powershell
$env:LOGIN_URL = "https://your-site.example/login"
$env:LOGIN_USERNAME = "DOP.MI4135160100005"
$env:LOGIN_PASSWORD = "Post@1122"

$env:USERNAME_SELECTOR = "#userId"
$env:PASSWORD_SELECTOR = "#password"
$env:CAPTCHA_IMAGE_SELECTOR = "#IMAGECAPTCHA"
$env:CAPTCHA_INPUT_SELECTOR = "#captcha"
$env:SUBMIT_SELECTOR = "#loginButton"
$env:SUCCESS_SELECTOR = "text=Logout"
```

Use your page's real selectors. From your snippet, CAPTCHA image selector is `#IMAGECAPTCHA`.

## 3) Run

```powershell
python .\login_with_manual_captcha.py
```

When CAPTCHA is shown, solve it in the browser window, then return to terminal and press Enter.

run the following command to extract the data and update it in db 
python .\extract_agent_rd_report.py

run the following command to update the database from the csv 
python update_accounts_from_csv.py