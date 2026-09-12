from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("GROQ_API_KEY", "test-api-key")
os.environ.setdefault("BACKEND_API_KEY", "test-backend-key")

PACKAGE_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = PACKAGE_DIR.parent
sys.path.insert(0, str(PROJECT_DIR))
