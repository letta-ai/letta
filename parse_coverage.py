#!/usr/bin/env python3
"""
Parse coverage JSON and create a sorted list of files by usage.
Run this from /tmp to avoid circular import issues.

Usage:
  cd /tmp
  python3 /path/to/parse_coverage.py
"""
import json

def parse_coverage():
    try:
        with open('/tmp/letta_coverage.json') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("❌ Error: /tmp/letta_coverage.json not found")
        print("Run coverage analysis first!")
        return

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
    high_count = len(high_coverage) if high_coverage else 0
    medium_count = len(medium_coverage) if medium_coverage else 0
    low_count = len(low_coverage) if low_coverage else 0
    unused_count = len(unused) if unused else 0

    print('\n✅ Coverage analysis complete!')
    print(f'\nTotal files analyzed: {total_count}')
    print(f'  🔥 High usage (>50%):     {high_count:3d} files')
    print(f'  ⚡ Moderate (10-50%):      {medium_count:3d} files')
    print(f'  💤 Low usage (1-10%):      {low_count:3d} files')
    print(f'  ❌ Unused (0%):            {unused_count:3d} files')
    print(f'\nResults saved to: /tmp/letta_files_used.txt')

if __name__ == '__main__':
    parse_coverage()
