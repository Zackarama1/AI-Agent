"""Claude-powered insights: the daily 'what happened & why' portfolio brief.

This is the feature Apple Stocks structurally won't ship. We hand Claude the
live account (positions + recent per-name news) and ask for a tight,
plain-English readout. Falls back to a templated brief when ANTHROPIC_API_KEY
is unset.
"""

from .config import settings
from .market import get_company_news
from .models import AccountSummary, Brief

SYSTEM_PROMPT = """You are a concise, trustworthy investing assistant inside a \
portfolio app. You explain what happened to the user's positions and why, in \
plain English.

Rules:
- Be brief: 4-6 sentences total, no preamble.
- Lead with the account's overall day move, then call out the 1-2 biggest \
movers and the most likely reason based on the news provided.
- Never give buy/sell recommendations or price targets. Describe, don't advise.
- If the news doesn't explain a move, say the move happened without a clear \
news catalyst rather than inventing one.
- End with one short, neutral thing worth watching (e.g. an upcoming earnings \
theme), not advice.
"""


def _mock_brief(summary: AccountSummary) -> Brief:
    if not summary.positions:
        return Brief(
            text="Your account is all cash. Buy a stock to get a daily brief.",
            is_mock=True,
        )
    movers = sorted(summary.positions, key=lambda p: abs(p.day_change), reverse=True)
    top = movers[0]
    direction = "up" if summary.day_change >= 0 else "down"
    top_dir = "gained" if top.day_change >= 0 else "fell"
    text = (
        f"Your account is {direction} {abs(summary.day_change_percent):.2f}% today "
        f"(${summary.day_change:,.2f}), now worth ${summary.total_value:,.2f} "
        f"(${summary.cash:,.2f} cash). "
        f"The biggest mover was {top.symbol}, which {top_dir} "
        f"{abs(top.day_change_percent):.2f}%. "
        "This is a templated summary — add an ANTHROPIC_API_KEY to get an "
        "AI-written explanation that reads the day's news for each position."
    )
    return Brief(text=text, is_mock=True)


async def generate_brief(summary: AccountSummary) -> Brief:
    if not summary.positions or not settings.has_anthropic:
        return _mock_brief(summary)

    # Pull a little recent news for the top movers to ground the explanation.
    movers = sorted(summary.positions, key=lambda p: abs(p.day_change), reverse=True)[:3]
    news_blob = ""
    for p in movers:
        items = await get_company_news(p.symbol, days=3)
        headlines = "; ".join(i.headline for i in items[:3]) or "no recent news"
        news_blob += f"\n{p.symbol} ({p.day_change_percent:+.2f}% today): {headlines}"

    position_lines = "\n".join(
        f"- {p.symbol}: {p.quantity:g} sh, value ${p.market_value:,.2f}, "
        f"day {p.day_change_percent:+.2f}%, total P/L {p.unrealized_pl_percent:+.2f}%"
        for p in summary.positions
    )
    user_msg = (
        f"Account value ${summary.total_value:,.2f} "
        f"(${summary.cash:,.2f} cash + ${summary.market_value:,.2f} in positions), "
        f"day change {summary.day_change_percent:+.2f}% (${summary.day_change:,.2f}).\n\n"
        f"Positions:\n{position_lines}\n\n"
        f"Recent news for the biggest movers:{news_blob}\n\n"
        "Write the daily brief."
    )

    from anthropic import Anthropic

    client = Anthropic(api_key=settings.anthropic_api_key)
    resp = client.messages.create(
        model=settings.claude_model,
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    return Brief(text=text, is_mock=False)
