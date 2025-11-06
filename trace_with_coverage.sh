#!/bin/bash
# Track code coverage to see what actually gets executed
# Usage: ./trace_with_coverage.sh

echo "Installing coverage tool..."
pip install coverage

echo "Starting Letta server with coverage tracking..."
echo "Press Ctrl+C after making a few API calls to stop tracking"
echo ""

# Run letta server with coverage
coverage run --source=letta -m letta.cli.cli server --host 0.0.0.0 --port 8283

echo ""
echo "Generating coverage report..."

# Generate a report showing which files were used
coverage report --omit="*/tests/*,*/test_*" > /tmp/letta_coverage_summary.txt

# Generate detailed HTML report
coverage html --omit="*/tests/*,*/test_*" -d /tmp/letta_coverage_html

# Generate a list of all files that were executed
coverage json --omit="*/tests/*,*/test_*" -o /tmp/letta_coverage.json

# Parse JSON to get list of files actually used
python3 -c "
import json
with open('/tmp/letta_coverage.json') as f:
    data = json.load(f)

files_used = []
for filepath, info in data['files'].items():
    if 'letta/' in filepath:
        # Get relative path
        rel_path = filepath.split('letta/')[-1]
        percent = info['summary']['percent_covered']
        files_used.append((rel_path, percent))

# Sort by coverage percentage (highest first)
files_used.sort(key=lambda x: x[1], reverse=True)

with open('/tmp/letta_files_used.txt', 'w') as out:
    out.write('FILES ACTUALLY USED (sorted by % coverage):\n')
    out.write('=' * 80 + '\n')
    for filepath, percent in files_used:
        if percent > 0:  # Only show files that were actually executed
            out.write(f'{percent:5.1f}%  {filepath}\n')

print(f'Found {len([f for f in files_used if f[1] > 0])} files actually used')
"

echo ""
echo "="
echo "Coverage analysis complete!"
echo "="
echo ""
echo "Results saved to:"
echo "  - /tmp/letta_coverage_summary.txt  (summary)"
echo "  - /tmp/letta_files_used.txt        (files actually used)"
echo "  - /tmp/letta_coverage_html/        (detailed HTML report)"
echo ""
echo "View the HTML report:"
echo "  open /tmp/letta_coverage_html/index.html"
