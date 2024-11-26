"""
This is a setup.py script generated by py2applet

Usage:
    python setup.py py2app
"""

from setuptools import setup
# there is an import recursion leak somewhere upstream
# this hack gets us past it
import sys
sys.setrecursionlimit(5000)

APP = ['startup.py']
DATA_FILES = ['assets']
OPTIONS = {'iconfile': 'assets/letta.icns',
           'includes': ['pgserver']}

setup(
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS, 'plist': {'CFBundleName': 'Letta', 'CFBundleShortVersionString': '0.5.5', 'CFBundleVersion': '0.5.5'}},
    setup_requires=['py2app'],
)
