"""
Per-venue booking adapters.

Booking a table means driving *some* site's form. Sites differ, so this is a
small registry that, given a venue name or URL, returns:
  - start_url : where the agent should begin
  - hints     : short, site-specific guidance appended to the agent's task
                (which button opens availability, how the time picker works…)

Today it holds the built-in demo restaurant plus a couple of platform notes.
As you support real venues, add an entry keyed by domain (or a venue->url
lookup from your own DB). Keep hints short and factual — they go straight into
the agent's instructions.
"""

from urllib.parse import urlparse

# Built-in local practice restaurant (multi-step: party/date/time -> availability
# -> guest details -> confirm). Used when no real URL is given, so a booking
# always has a realistic target to run against.
DEMO_RESERVE_URL = "/demo/reserve"

_DOMAIN_HINTS = {
    "opentable.com": (
        "OpenTable: set party size and time in the top reservation bar, then click a "
        "time slot chip to proceed. You may need to sign in — if a login wall or CAPTCHA "
        "blocks you, stop and report needs_human."
    ),
    "resy.com": (
        "Resy: pick party size and date, click an available time, then 'Reserve now'. "
        "Requires an account; if blocked by login/CAPTCHA, report needs_human."
    ),
    "exploretock.com": (
        "Tock: choose party size and date, select a time, continue to the details step."
    ),
    "sevenrooms.com": (
        "SevenRooms: select date/party/time, pick a slot, then fill guest details."
    ),
}

_DEMO_HINT = (
    "This is a multi-step form: choose party size and time from the dropdowns and set "
    "the date, click 'Check availability', pick an available time slot (8:00 PM is "
    "shown but unavailable — choose the closest open slot), then fill name/phone and "
    "click 'Confirm reservation'. Read the page after each step."
)


def _domain(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def adapter_for(start_url: str = "", venue: str = "") -> dict:
    """Resolve a reservation to a concrete start_url + agent hints.

    - No/blank URL, or the sentinel '/demo/reserve' -> the local demo restaurant.
    - A known platform domain -> that platform's hint.
    - Anything else -> use the URL as-is with no special hints.
    """
    url = (start_url or "").strip()
    if not url or url == DEMO_RESERVE_URL:
        return {"start_url": DEMO_RESERVE_URL, "hints": _DEMO_HINT, "adapter": "demo"}

    domain = _domain(url)
    for known, hint in _DOMAIN_HINTS.items():
        if domain == known or domain.endswith("." + known):
            return {"start_url": url, "hints": hint, "adapter": known}

    return {"start_url": url, "hints": "", "adapter": "generic"}
