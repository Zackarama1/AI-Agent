"""
Runs every task in a folder, `--repeats` times each, and writes results.csv.
This CSV is the actual deliverable of Step 1 — your real reliability number.

Usage:
    python run_reliability_test.py --tasks tasks/ --repeats 5
"""

import argparse
import asyncio
import csv
import glob
import os
import time

from agent import load_task, run_task


async def main(tasks_dir: str, repeats: int, out_path: str):
    task_files = sorted(glob.glob(os.path.join(tasks_dir, "*.yaml")))
    if not task_files:
        print(f"No .yaml task files found in {tasks_dir}")
        return

    rows = []
    for task_file in task_files:
        task = load_task(task_file)
        for attempt in range(1, repeats + 1):
            print(f"\n=== {os.path.basename(task_file)} — attempt {attempt}/{repeats} ===")
            start = time.time()
            try:
                result = await run_task(task, headed=False)
            except Exception as e:
                result = {"outcome": "failed", "note": f"exception: {e}", "steps": -1}
            elapsed = round(time.time() - start, 1)

            rows.append({
                "task_file": os.path.basename(task_file),
                "attempt": attempt,
                "outcome": result["outcome"],
                "steps": result["steps"],
                "seconds": elapsed,
                "note": result["note"],
            })
            print(f"-> {result['outcome']} in {result['steps']} steps, {elapsed}s: {result['note']}")

    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["task_file", "attempt", "outcome", "steps", "seconds", "note"])
        writer.writeheader()
        writer.writerows(rows)

    successes = sum(1 for r in rows if r["outcome"] == "success")
    print(f"\n\nDone. {successes}/{len(rows)} succeeded ({100*successes/len(rows):.0f}%). See {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tasks", default="tasks/", help="Folder of task YAML files")
    parser.add_argument("--repeats", type=int, default=5, help="Repeats per task")
    parser.add_argument("--out", default="results.csv")
    args = parser.parse_args()

    asyncio.run(main(args.tasks, args.repeats, args.out))
