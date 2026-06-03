import os
import shutil
try:
    import winreg
except ImportError:
    winreg = None
from typing import Optional

# Conditionally import winreg (Windows-only)
if os.name == "nt":
    import winreg

# Common install locations on Windows (checked in order after env / PATH)
_WINDOWS_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
]


def _read_windows_registry_path() -> Optional[str]:
    if os.name != "nt":
        return None
    for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        try:
            with winreg.OpenKey(hive, r"SOFTWARE\Tesseract-OCR") as key:
                install_dir, _ = winreg.QueryValueEx(key, "InstallDir")
                candidate = os.path.join(install_dir, "tesseract.exe")
                if os.path.isfile(candidate):
                    return candidate
        except OSError:
            continue
    return None


def resolve_tesseract_cmd(configured: Optional[str] = None) -> Optional[str]:
    """
    Resolve the Tesseract executable path.
    Priority: .env value (if file exists) -> PATH -> Windows registry -> common folders.
    """
    if configured:
        normalized = os.path.normpath(configured.strip().strip('"'))
        if os.path.isfile(normalized):
            return normalized

    which = shutil.which("tesseract")
    if which:
        return which

    if os.name == "nt":
        registry_path = _read_windows_registry_path()
        if registry_path:
            return registry_path
        for candidate in _WINDOWS_CANDIDATES:
            if os.path.isfile(candidate):
                return candidate

    return None


def check_tesseract(configured: Optional[str] = None) -> dict:
    """Return install status for health checks and startup logs."""
    path = resolve_tesseract_cmd(configured)
    if not path:
        return {
            "installed": False,
            "path": None,
            "version": None,
            "languages": [],
            "message": (
                "Tesseract OCR is not installed or TESSERACT_CMD in .env points to the wrong file. "
                "Install from https://github.com/UB-Mannheim/tesseract/wiki or run: "
                "winget install UB-Mannheim.TesseractOCR"
            ),
        }

    import subprocess

    try:
        version_proc = subprocess.run(
            [path, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        version_line = (version_proc.stdout or version_proc.stderr or "").splitlines()
        version = version_line[0].strip() if version_line else "unknown"

        langs_proc = subprocess.run(
            [path, "--list-langs"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        lang_lines = (langs_proc.stdout or "").splitlines()
        languages = []
        if lang_lines:
            # First line is usually "List of available languages (N):"
            languages = [l.strip() for l in lang_lines[1:] if l.strip()]

        return {
            "installed": True,
            "path": path,
            "version": version,
            "languages": languages,
            "message": f"Tesseract OCR version {version} found at {path}",
        }
    except Exception as e:
        return {
            "installed": False,
            "path": path,
            "version": None,
            "languages": [],
            "message": f"Error checking Tesseract version: {str(e)}",
        }
