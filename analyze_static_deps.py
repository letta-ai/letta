#!/usr/bin/env python3
"""
Static analysis: Find what imports what without running code.
Usage: python analyze_static_deps.py

This creates a dependency graph showing what each module imports.
"""
import os
import ast
from pathlib import Path
from collections import defaultdict

def find_imports(filepath):
    """Extract all imports from a Python file."""
    imports = set()
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read(), filepath)

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.add(alias.name.split('.')[0])
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.add(node.module.split('.')[0])

    except Exception as e:
        print(f"Error parsing {filepath}: {e}")

    return imports

def analyze_letta():
    """Analyze all Python files in the letta directory."""
    letta_dir = Path('letta')
    all_files = list(letta_dir.rglob('*.py'))

    print(f"Analyzing {len(all_files)} Python files...")

    # Track dependencies
    file_imports = {}
    letta_file_deps = defaultdict(set)

    for filepath in all_files:
        rel_path = str(filepath.relative_to('letta'))

        # Skip test files
        if 'test' in rel_path.lower():
            continue

        imports = find_imports(filepath)

        # Store all imports
        file_imports[rel_path] = imports

        # Track internal letta dependencies
        letta_imports = [imp for imp in imports if imp == 'letta']
        if letta_imports:
            letta_file_deps[rel_path] = letta_imports

    # Find external dependencies
    all_external_deps = set()
    for imports in file_imports.values():
        all_external_deps.update(imports)

    # Remove 'letta' itself
    all_external_deps.discard('letta')

    # Common stdlib modules to exclude
    stdlib = {
        'os', 'sys', 're', 'json', 'time', 'datetime', 'typing', 'pathlib',
        'collections', 'itertools', 'functools', 'abc', 'enum', 'io',
        'logging', 'warnings', 'traceback', 'copy', 'asyncio', 'contextlib',
        'dataclasses', 'uuid', 'hashlib', 'base64', 'tempfile', 'shutil',
    }

    external_deps = sorted(all_external_deps - stdlib)

    # Save results
    with open('/tmp/letta_static_analysis.txt', 'w') as f:
        f.write("EXTERNAL DEPENDENCIES (non-stdlib):\n")
        f.write("=" * 80 + "\n")
        for dep in external_deps:
            # Count how many files use each dependency
            count = sum(1 for imports in file_imports.values() if dep in imports)
            f.write(f"{count:4d} files use: {dep}\n")

        f.write("\n\nFILES BY DIRECTORY:\n")
        f.write("=" * 80 + "\n")

        # Group files by directory
        by_dir = defaultdict(list)
        for filepath in file_imports.keys():
            directory = os.path.dirname(filepath) or 'root'
            by_dir[directory].append(filepath)

        for directory in sorted(by_dir.keys()):
            f.write(f"\n{directory}/\n")
            for filepath in sorted(by_dir[directory]):
                f.write(f"  {os.path.basename(filepath)}\n")

    print(f"\nFound {len(external_deps)} external dependencies")
    print(f"Analyzed {len(file_imports)} Python files")
    print(f"\nResults saved to /tmp/letta_static_analysis.txt")

if __name__ == "__main__":
    analyze_letta()
