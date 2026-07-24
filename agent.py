"""
The agent loop: gives Claude a task + browser tools, lets it act step by
step until it calls task_complete or hits a step limit.

Usage:
    python agent.py --task tasks/example_form_signup.yaml --headed
"""

import argparse
import asyncio
import os
import sys

import yaml
from anthropic import Anthropic
from dotenv import load_dotenv

from browser_tools import BrowserSession, TOOL_DEFINITIONS, execute_tool

load_dotenv()

MODEL = "claude-sonnet-5"
MAX_STEPS = 20  # safety cap so a confused agent can't loop forever / rack up cost

SYSTEM_PROMPT = """You are a browser automation agent completing a real task on a
real website. Use the tools to navigate, read the page, click, and fill forms.

Rules:
- Always call read_page after navigate/click/fill to see the result before your next move.
- Work at a normal, human-plausible pace — do not try to bypass CAPTCHAs, queues,
  rate limits, or any anti-automation measure. If you hit one, stop and call
  task_complete with outcome "needs_human".
- If a required field or choice is ambiguous and you cannot infer it from the
  task, make the most sensible assumption and note it — don't get stuck.
- If you reach a real payment/checkout step, call submit_payment (it is
  simulated) rather than trying to fill card fields directly.
- Call task_complete as soon as the task is done, or if you're stuck and can't proceed.
"""


async def run_task(task: dict, headed: bool) -> dict:
    client = Anthropic()  # reads ANTHROPIC_API_KEY from env
    session = BrowserSession(headed=headed)
    await session.start()

    messages = [
        {
            "role": "user",
            "content": (
                f"Task: {task['instruction']}\n"
                f"Starting URL: {task['start_url']}\n\n"
                "Begin by navigating to the starting URL."
            ),
        }
    ]

    result = {"outcome": "failed", "note": "hit max step limit", "steps": 0}

    for step in range(MAX_STEPS):
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,
            messages=messages,
        )

        messages.append({"role": "assistant", "content": response.content})

        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if not tool_uses:
            # Model responded with just text — nudge it to act or finish.
            messages.append({
                "role": "user",
                "content": "Please continue using tools, or call task_complete.",
            })
            continue

        tool_results = []
        done = False
        for tool_use in tool_uses:
            if tool_use.name == "task_complete":
                result = {
                    "outcome": tool_use.input.get("outcome", "failed"),
                    "note": tool_use.input.get("note", ""),
                    "steps": step + 1,
                }
                done = True
                break

            output = await execute_tool(session, tool_use.name, tool_use.input)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": output,
            })

        if done:
            break

        messages.append({"role": "user", "content": tool_results})

    await session.stop()
    return result


def load_task(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True, help="Path to a task YAML file")
    parser.add_argument("--headed", action="store_true", help="Show the browser window")
    args = parser.parse_args()

    if not os.getenv("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY in your .env file first (see .env.example).")

    task = load_task(args.task)
    result = asyncio.run(run_task(task, headed=args.headed))
    print(f"\nResult: {result}")
