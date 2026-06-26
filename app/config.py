import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

_raw = os.getenv("BASE_DIR", "").strip()
BASE_DIR: Path = Path(_raw).resolve() if _raw else Path.home().resolve()
