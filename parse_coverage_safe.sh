#!/bin/bash
# Parse coverage JSON without Python import conflicts
# Usage: ./parse_coverage_safe.sh

COVERAGE_JSON="/tmp/letta_coverage.json"
OUTPUT_FILE="/tmp/letta_files_used.txt"

if [ ! -f "$COVERAGE_JSON" ]; then
    echo "❌ Error: $COVERAGE_JSON not found"
    echo "Run coverage analysis first!"
    exit 1
fi

echo "Parsing coverage data..."

# Use Python in an isolated way - explicitly unset PYTHONPATH and use absolute paths only
env -i PATH="$PATH" HOME="$HOME" python3 - <<'PYTHON_SCRIPT'
import json
import sys

# Make sure we don't import from current directory
sys.path = [p for p in sys.path if 'letta' not in p.lower()]

try:
    with open('/tmp/letta_coverage.json') as f:
        data = json.load(f)
except Exception as e:
    print(f"Error loading JSON: {e}")
    sys.exit(1)

files_used = []
for filepath, info in data['files'].items():
    if 'letta/' in filepath:
        rel_path = filepath.split('letta/')[-1]
        percent = info['summary']['percent_covered']
        files_used.append((rel_path, percent))

files_used.sort(key=lambda x: x[1], reverse=True)

with open('/tmp/letta_files_used.txt', 'w') as out:
    out.write('FILES ACTUALLY USED (sorted by % coverage):\n')
    out.write('=' * 80 + '\n')
    out.write('\n')

    # Files with >50% coverage - CORE
    high_coverage = [(f, p) for f, p in files_used if p >= 50]
    if high_coverage:
        out.write('🔥 HIGH USAGE (>50% - Core files):\n')
        out.write('-' * 80 + '\n')
        for filepath, percent in high_coverage:
            out.write(f'{percent:5.1f}%  {filepath}\n')
        out.write('\n')

    # Files with 10-50% coverage - MODERATE
    medium_coverage = [(f, p) for f, p in files_used if 10 <= p < 50]
    if medium_coverage:
        out.write('⚡ MODERATE USAGE (10-50% - Partially used):\n')
        out.write('-' * 80 + '\n')
        for filepath, percent in medium_coverage:
            out.write(f'{percent:5.1f}%  {filepath}\n')
        out.write('\n')

    # Files with 1-10% coverage - LOW
    low_coverage = [(f, p) for f, p in files_used if 1 <= p < 10]
    if low_coverage:
        out.write('💤 LOW USAGE (1-10% - Rarely used):\n')
        out.write('-' * 80 + '\n')
        for filepath, percent in low_coverage:
            out.write(f'{percent:5.1f}%  {filepath}\n')
        out.write('\n')

    # Files with 0% coverage - UNUSED
    unused = [(f, p) for f, p in files_used if p == 0]
    if unused:
        out.write('❌ UNUSED (0% - Potentially removable):\n')
        out.write('-' * 80 + '\n')
        for filepath, percent in unused:
            out.write(f'{percent:5.1f}%  {filepath}\n')
        out.write('\n')

# Print summary
used_count = len([f for f, p in files_used if p > 0])
total_count = len(files_used)
high_count = len(high_coverage)
medium_count = len(medium_coverage)
low_count = len(low_coverage)
unused_count = len(unused)

print('\n✅ Coverage analysis complete!')
print(f'\nTotal files analyzed: {total_count}')
print(f'  🔥 High usage (>50%):     {high_count:3d} files')
print(f'  ⚡ Moderate (10-50%):      {medium_count:3d} files')
print(f'  💤 Low usage (1-10%):      {low_count:3d} files')
print(f'  ❌ Unused (0%):            {unused_count:3d} files')
print(f'\nResults saved to: /tmp/letta_files_used.txt')
PYTHON_SCRIPT

echo ""
echo "View results:"
echo "  cat /tmp/letta_files_used.txt"
