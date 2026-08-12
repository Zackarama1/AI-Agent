"""Claude-powered insights: the daily 'what happened & why' portfolio brief.

This is the feature Apple Stocks structurally won't ship. We hand Claude the
live portfolio plus recent per-holding news and ask for a tight, plain-English
readout. Falls back to a templated brief when ANTHROPIC_API_KEY is unset.
"""

from .config import settings
from .market import get_company_news
from .models import Brief, PortfolioSummary

SYSTEM_PROMPT = """You are a concise, trustworthy investing assistant inside a \
portfolio app. You explain what happened to the user's holdings and why, in \
plain English.

Rules:
- Be brief: 4-6 sentences total, no preamble.
- Lead with the portfolio's overall day move, then call out the 1-2 biggest \
movers and the most likely reason based on the news provided.
- Never give buy/sell recommendations or price targets. Describe, don't advise.
- If the news doesn't explain a move, say the move happened without a clear \
news catalyst rather than inventing one.
- End with one short, neutral thing worth watching (e.g. an upcoming earnings \
theme), not advice.
"""


def _mock_brief(summary: PortfolioSummary) -> Brief:
    if not summary.holdings:
        return Brief(text="Your portfolio is empty. Add a holding to get a daily brief.", is_mock=True)
    movers = sorted(summary.holdings, key=lambda h: abs(h.day_change), reverse=True)
    top = movers[0]
    direction = "up" if summary.day_change >= 0 else "down"
    top_dir = "gained" if top.day_change >= 0 else "fell"
    text = (
        f"Your portfolio is {direction} {abs(summary.day_change_percent):.2f}% today "
        f"(${summary.day_change:,.2f}), now worth ${summary.total_value:,.2f}. "
        f"The biggest mover was {top.symbol}, which {top_dir} "
        f"{abs(top.day_change_percent):.2f}%. "
        "This is a templated summary — add an ANTHROPIC_API_KEY to get an "
        "AI-written explanation that reads the day's news for each holding."
    )
    return Brief(text=text, is_mock=True)


async def generate_brief(summary: PortfolioSummary) -> Brief:
    if not summary.holdings:
        return _mock_brief(summary)
    if not settings.has_anthropic:
        return _mock_brief(summary)

    # Pull a little recent news for the top movers to ground the explanation.
    movers = sorted(summary.holdings, key=lambda h: abs(h.day_change), reverse=True)[:3]
    news_blob = ""
    for h in movers:
        items = await get_company_news(h.symbol, days=3)
        headlines = "; ".join(i.headline for i in items[:3]) or "no recent news"
        news_blob += f"\n{h.symbol} ({h.day_change_percent:+.2f}% today): {headlines}"

    holdings_lines = "\n".join(
        f"- {h.symbol}: {h.shares} sh, value ${h.market_value:,.2f}, "
        f"day {h.day_change_percent:+.2f}%, total P/L {h.gain_percent:+.2f}%"
        for h in summary.holdings
    )
    user_msg = (
        f"Portfolio value ${summary.total_value:,.2f}, "
        f"day change {summary.day_change_percent:+.2f}% (${summary.day_change:,.2f}).\n\n"
        f"Holdings:\n{holdings_lines}\n\n"
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
