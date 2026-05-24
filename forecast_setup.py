#!/usr/bin/env python3
"""
One-time setup for the Kronos forecast widget.
Run from the dashboard directory:

    python3 forecast_setup.py

What it does:
  1. Clones the Kronos model repo into kronos_src/
  2. Installs the Python requirements
  3. Pre-downloads the model weights from HuggingFace
     (~300 MB, cached in ~/.cache/huggingface/)
"""

import subprocess
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def run(cmd, **kwargs):
    print(f'\n  → {" ".join(str(c) for c in cmd)}')
    subprocess.run(cmd, check=True, **kwargs)


print('\n◈ MEEZUS Forecast Setup\n' + '─' * 40)

# ── 1. Clone repo ─────────────────────────────────────────────────────────────
src = os.path.join(HERE, 'kronos_src')
if os.path.isdir(src):
    print(f'\n  kronos_src/ already exists — skipping clone.')
    print(f'  (delete it and re-run to force a fresh clone)')
else:
    run(['git', 'clone', 'https://github.com/shiyu-coder/Kronos', src])

# ── 2. Install only what the model actually needs (skip matplotlib/mplfinance
#       which are only used for plotting scripts we don't use) ─────────────────
DEPS = [
    'torch',
    'transformers',
    'huggingface_hub',
    'pandas',
    'numpy',
    'einops',
    'safetensors',
    'accelerate',
]
run([sys.executable, '-m', 'pip', 'install'] + DEPS)

# ── 3. Pre-download model weights from HuggingFace ───────────────────────────
print('\n  Pre-downloading Kronos-mini weights (~300 MB)…')
sys.path.insert(0, src)
try:
    from model import Kronos, KronosTokenizer
    KronosTokenizer.from_pretrained('NeoQuasar/Kronos-Tokenizer-2k')
    Kronos.from_pretrained('NeoQuasar/Kronos-mini')
    print('\n  ✓ Weights cached.\n')
except Exception as e:
    print(f'\n  ✗ Weight download failed: {e}')
    print('  The server will try again on first forecast request.\n')
    sys.exit(1)

print('◈ Setup complete! Restart server.py to enable the forecast widget.\n')
