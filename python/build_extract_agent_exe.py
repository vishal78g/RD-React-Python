import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "extract_agent_rd_report.py"
ENV_FILE = ROOT / ".env"


def run_cmd(cmd: list[str]) -> None:
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)


def main() -> None:
    if not SCRIPT.exists():
        raise FileNotFoundError(f"Missing script: {SCRIPT}")
    if not ENV_FILE.exists():
        raise FileNotFoundError(f"Missing .env file: {ENV_FILE}")

    python_exe = sys.executable

    run_cmd([python_exe, "-m", "pip", "install", "-r", str(ROOT / "requirements.txt")])

    pyinstaller_cmd = [
        python_exe,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        "--name",
        "extract_agent_rd_report",
        "--add-data",
        ".env;.",
        "--collect-all",
        "playwright",
        "--collect-all",
        "supabase",
        "--collect-all",
        "postgrest",
        "--collect-all",
        "gotrue",
        "--collect-all",
        "realtime",
        "--collect-all",
        "storage3",
        str(SCRIPT),
    ]
    run_cmd(pyinstaller_cmd)

    dist_exe = ROOT / "dist" / "extract_agent_rd_report.exe"
    if dist_exe.exists():
        print(f"\nBuild complete: {dist_exe}")
    else:
        print("\nBuild finished, but exe not found in expected location.")


if __name__ == "__main__":
    main()
