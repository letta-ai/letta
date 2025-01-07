# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from pathlib import Path
sys.setrecursionlimit(10000)

a = Analysis(
    ['letta_desktop/__init__.py'],
    pathex=[],
    binaries=[
        ('.venv/lib/python3.12/site-packages/pgserver/pginstall', 'pgserver/pginstall')
    ],
    datas=[
        ('.venv/lib/python3.12/site-packages/letta/humans/examples', 'letta/humans/examples'),
        ('.venv/lib/python3.12/site-packages/letta/personas/examples', 'letta/personas/examples'),
        ('.venv/lib/python3.12/site-packages/letta/prompts/system', 'letta/prompts/system'),
        ('.venv/lib/python3.12/site-packages/letta/functions/function_sets', 'letta/functions/function_sets'),
        ('letta_desktop', 'letta_desktop'),
    ],
    hiddenimports=[
        'tiktoken_ext',
        'tiktoken_ext.openai_public',
      ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.datas,
    a.binaries,
    [],
    name='letta',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

