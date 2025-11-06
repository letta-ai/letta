#!/usr/bin/env python3
"""
Track all function calls in Letta modules.
Usage: python trace_calls.py

This will create /tmp/letta_trace.txt with all function calls
"""
import sys
import os

# Track function calls
call_counts = {}
files_used = set()

def trace_calls(frame, event, arg):
    if event != 'call':
        return

    # Get the code object
    code = frame.f_code
    filename = code.co_filename
    function_name = code.co_name

    # Only track letta modules
    if 'letta' in filename and '/letta/' in filename:
        # Extract relative path from letta/
        try:
            rel_path = filename.split('/letta/')[-1]
            files_used.add(rel_path)

            # Track function calls
            key = f"{rel_path}:{function_name}"
            call_counts[key] = call_counts.get(key, 0) + 1

        except:
            pass

    return trace_calls

if __name__ == "__main__":
    print("=" * 80)
    print("Starting Letta with call tracing...")
    print("This will be slow - only run a simple test!")
    print("=" * 80)

    # Enable tracing
    sys.settrace(trace_calls)

    try:
        # Import and run
        from letta.cli.cli import run
        sys.argv = ['letta', 'server', '--host', '0.0.0.0', '--port', '8283']
        run()

    except KeyboardInterrupt:
        print("\n" + "=" * 80)
        print("Tracing complete!")
        print("=" * 80)

    finally:
        # Disable tracing
        sys.settrace(None)

        # Save results
        with open('/tmp/letta_trace.txt', 'w') as f:
            f.write("FILES USED:\n")
            f.write("=" * 80 + "\n")
            for file in sorted(files_used):
                f.write(f"{file}\n")

            f.write("\n\nFUNCTION CALLS (sorted by frequency):\n")
            f.write("=" * 80 + "\n")
            for key, count in sorted(call_counts.items(), key=lambda x: x[1], reverse=True):
                f.write(f"{count:6d}  {key}\n")

        print(f"\nFiles used: {len(files_used)}")
        print(f"Function calls tracked: {sum(call_counts.values())}")
        print(f"\nResults saved to /tmp/letta_trace.txt")
