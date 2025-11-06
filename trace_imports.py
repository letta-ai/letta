#!/usr/bin/env python3
"""
Track all imports when running Letta server.
Usage: python trace_imports.py
"""
import sys
import os
import importlib.abc
import importlib.machinery

# Configure Letta to use proxy
PROXY_PORT = os.environ.get('LETTA_PROXY_PORT', '5001')
os.environ['LMSTUDIO_BASE_URL'] = f'http://127.0.0.1:{PROXY_PORT}'
os.environ['OPENAI_API_KEY'] = 'dummy-key'

# Track all imported modules
imported_modules = set()
letta_modules = set()

class ImportTracker(importlib.abc.MetaPathFinder):
    def find_module(self, fullname, path=None):
        # Track all imports
        imported_modules.add(fullname)

        # Track Letta-specific imports
        if fullname.startswith('letta'):
            letta_modules.add(fullname)
            print(f"[LETTA IMPORT] {fullname}")

        return None  # Let the normal import system handle it

# Install the import tracker
sys.meta_path.insert(0, ImportTracker())

# Now import and run letta
if __name__ == "__main__":
    print(f"Proxy URL: http://127.0.0.1:{PROXY_PORT}")
    print("=" * 80)
    print("=" * 80)
    print("Starting Letta with import tracking...")
    print("=" * 80)

    # Import letta's CLI entry point
    from letta.cli.cli import run

    # Run the server command
    # Note: This will actually start the server, so Ctrl+C when you want to stop
    try:
        sys.argv = ['letta', 'server', '--host', '0.0.0.0', '--port', '8283']
        run()
    except KeyboardInterrupt:
        print("\n" + "=" * 80)
        print("Import tracking complete!")
        print("=" * 80)

        # Save results
        with open('/tmp/letta_imports.txt', 'w') as f:
            f.write("ALL LETTA MODULES IMPORTED:\n")
            f.write("=" * 80 + "\n")
            for mod in sorted(letta_modules):
                f.write(f"{mod}\n")

        print(f"\nTotal modules imported: {len(imported_modules)}")
        print(f"Letta modules imported: {len(letta_modules)}")
        print(f"\nResults saved to /tmp/letta_imports.txt")
