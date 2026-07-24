"""
A small set of browser actions exposed as Claude tool-use tools.

Design choice: rather than a pure vision/screenshot loop (slow, expensive,
harder to debug), the agent mostly reads a simplified text/accessibility
view of the page and acts on labeled elements. This is cheaper and more
reliable for form-filling and booking flows. A screenshot tool is included
for cases where the agent gets stuck and needs to actually look.
"""

import asyncio
from playwright.async_api import async_playwright, Page


class BrowserSession:
    def __init__(self, headed: bool = False):
        self.headed = headed
        self._pw = None
        self._browser = None
        self.page: Page | None = None

    async def start(self):
        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(headless=not self.headed)
        context = await self._browser.new_context()
        self.page = await context.new_page()

    async def stop(self):
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()

    # ---- tool implementations ----

    async def navigate(self, url: str) -> str:
        await self.page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await self.page.wait_for_timeout(500)  # let obvious JS settle
        return f"Navigated to {self.page.url}"

    async def read_page(self, max_chars: int = 4000) -> str:
        """Return a simplified text view: visible text plus interactive elements
        with simple selectors the agent can reference in later tool calls."""
        elements = await self.page.eval_on_selector_all(
            "a, button, input, select, textarea, [role=button]",
            """els => els.slice(0, 80).map((el, i) => {
                el.setAttribute('data-agent-id', String(i));
                const label = el.innerText || el.getAttribute('placeholder')
                    || el.getAttribute('aria-label') || el.getAttribute('name') || '';
                return `[${i}] <${el.tagName.toLowerCase()}> ${label.trim().slice(0,60)}`;
            }).join('\\n')"""
        )
        body_text = await self.page.inner_text("body")
        body_text = body_text.strip()[:max_chars]
        return f"URL: {self.page.url}\n\nInteractive elements:\n{elements}\n\nPage text (truncated):\n{body_text}"

    async def click(self, element_id: str) -> str:
        el = self.page.locator(f"[data-agent-id='{element_id}']")
        await el.click(timeout=10000)
        await self.page.wait_for_timeout(500)
        return f"Clicked element {element_id}"

    async def fill(self, element_id: str, text: str) -> str:
        el = self.page.locator(f"[data-agent-id='{element_id}']")
        await el.fill(text, timeout=10000)
        return f"Filled element {element_id} with '{text}'"

    async def screenshot(self, path: str = "debug_screenshot.png") -> str:
        await self.page.screenshot(path=path)
        return f"Saved screenshot to {path}"

    async def submit_payment(self, **kwargs) -> str:
        """STUBBED ON PURPOSE. Do not wire this to a real payment form until
        you've deliberately built the vault/Stripe flow. This just logs what
        the agent *would* have submitted, so you can see the intent without
        any risk."""
        return (
            "[SIMULATED] Payment step reached but not executed. "
            f"Would have submitted: {kwargs}. "
            "Wire up real Stripe test-mode tokenization when ready."
        )


# ---- tool schema Claude will see ----

TOOL_DEFINITIONS = [
    {
        "name": "navigate",
        "description": "Go to a URL in the browser.",
        "input_schema": {
            "type": "object",
            "properties": {"url": {"type": "string"}},
            "required": ["url"],
        },
    },
    {
        "name": "read_page",
        "description": (
            "Get a simplified text view of the current page: visible text plus "
            "a numbered list of interactive elements (links, buttons, inputs). "
            "Call this after every navigate/click/fill to see what changed."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "click",
        "description": "Click an interactive element by its [id] from read_page's element list.",
        "input_schema": {
            "type": "object",
            "properties": {"element_id": {"type": "string"}},
            "required": ["element_id"],
        },
    },
    {
        "name": "fill",
        "description": "Type text into an input/textarea element by its [id] from read_page.",
        "input_schema": {
            "type": "object",
            "properties": {
                "element_id": {"type": "string"},
                "text": {"type": "string"},
            },
            "required": ["element_id", "text"],
        },
    },
    {
        "name": "screenshot",
        "description": "Take a screenshot if you're stuck and need to visually inspect the page.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "submit_payment",
        "description": (
            "Call this ONLY at a real payment/checkout step. It is currently "
            "simulated and will not charge anything or submit real card details."
        ),
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": True},
    },
    {
        "name": "task_complete",
        "description": "Call this when the task is finished. Report success or failure and why.",
        "input_schema": {
            "type": "object",
            "properties": {
                "outcome": {"type": "string", "enum": ["success", "failed", "needs_human"]},
                "note": {"type": "string", "description": "Short explanation of what happened."},
            },
            "required": ["outcome", "note"],
        },
    },
]


async def execute_tool(session: BrowserSession, name: str, tool_input: dict) -> str:
    if name == "navigate":
        return await session.navigate(tool_input["url"])
    if name == "read_page":
        return await session.read_page()
    if name == "click":
        return await session.click(tool_input["element_id"])
    if name == "fill":
        return await session.fill(tool_input["element_id"], tool_input["text"])
    if name == "screenshot":
        return await session.screenshot()
    if name == "submit_payment":
        return await session.submit_payment(**tool_input)
    return f"Unknown tool: {name}"
