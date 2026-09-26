"""
Sulfide Sentinels - Person 2 Tests Package
"""

import sys
from pathlib import Path

# Ensure person2-ai root is in sys.path so 'src' is always importable
_person2_ai_dir = Path(__file__).resolve().parent.parent
if str(_person2_ai_dir) not in sys.path:
    sys.path.insert(0, str(_person2_ai_dir))
