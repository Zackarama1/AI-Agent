"""
Transactional confirmation emails.

When a booking is confirmed (or can't be completed), we email the guest. This
module is provider-agnostic and dependency-free (stdlib urllib):

  EMAIL_PROVIDER = resend | postmark | sendgrid | console   (default: console)
  <PROVIDER>_API_KEY = ...                                   (real providers)
  EMAIL_FROM = "Concierge <bookings@yourdomain.com>"

With no provider/key set it falls back to "console" mode: the email (HTML + the
.ics attachment) is written to data/outbox/ and logged, so the whole flow is
testable locally without sending anything.

Sending is blocking (urllib); call it from async code via asyncio.to_thread.
"""

import base64
import json
import os
import time
import urllib.request
from pathlib import Path

import store

OUTBOX = Path(__file__).resolve().parent / "data" / "outbox"


def _from() -> str:
    return os.getenv("EMAIL_FROM", "Concierge <bookings@concierge.local>")


def _provider() -> str:
    p = os.getenv("EMAIL_PROVIDER", "").lower().strip()
    if p:
        return p
    for name, env in (("resend", "RESEND_API_KEY"), ("postmark", "POSTMARK_API_KEY"),
                      ("sendgrid", "SENDGRID_API_KEY")):
        if os.getenv(env):
            return name
    return "console"


def _pretty_when(res: dict) -> str:
    from datetime import datetime
    try:
        dt = datetime.strptime(f"{res['date']} {res['time']}", "%Y-%m-%d %H:%M")
        return dt.strftime("%A, %B %-d · %-I:%M %p")
    except Exception:
        return f"{res.get('date','')} {res.get('time','')}".strip()


def _confirm_html(res: dict) -> str:
    ref = res["id"][:8].upper()
    return f"""\
<!doctype html><html><body style="margin:0;background:#e8eef0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#232b32">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#3fcabb,#2fb4a6 40%,#6c5ce7);border-radius:20px;padding:28px;color:#fff">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.9">Reservation confirmed</div>
      <div style="font-family:Georgia,serif;font-size:28px;margin-top:6px">{res.get('venue','Your table')}</div>
    </div>
    <div style="background:#fff;border-radius:20px;padding:24px;margin-top:14px;box-shadow:0 16px 36px -18px rgba(25,55,60,.3)">
      <table style="width:100%;border-collapse:collapse;font-size:15px">
        <tr><td style="color:#9aa6ad;padding:8px 0">When</td><td style="text-align:right;font-weight:600">{_pretty_when(res)}</td></tr>
        <tr><td style="color:#9aa6ad;padding:8px 0;border-top:1px solid #eef1f3">Party</td><td style="text-align:right;font-weight:600;border-top:1px solid #eef1f3">{res.get('party_size','?')} guests</td></tr>
        <tr><td style="color:#9aa6ad;padding:8px 0;border-top:1px solid #eef1f3">Under</td><td style="text-align:right;font-weight:600;border-top:1px solid #eef1f3">{res.get('name','')}</td></tr>
        <tr><td style="color:#9aa6ad;padding:8px 0;border-top:1px solid #eef1f3">Reference</td><td style="text-align:right;font-weight:600;border-top:1px solid #eef1f3">{ref}</td></tr>
      </table>
      <p style="color:#566069;font-size:14px;line-height:1.5;margin:18px 0 0">Your AI concierge booked this for you. The calendar invite is attached — add it in one tap. Need to change anything? Just ask the concierge in the app.</p>
    </div>
    <div style="text-align:center;color:#9aa6ad;font-size:12px;margin-top:16px">Booked with Concierge · this is a demo confirmation</div>
  </div>
</body></html>"""


def _failed_html(res: dict, note: str) -> str:
    return f"""\
<!doctype html><html><body style="margin:0;background:#e8eef0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#232b32">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:20px;padding:24px">
      <div style="font-family:Georgia,serif;font-size:22px">We couldn’t lock in {res.get('venue','your table')}</div>
      <p style="color:#566069;font-size:14px;line-height:1.5">{note or 'The time you asked for wasn’t available.'} Open the app and the concierge can try another time or venue.</p>
    </div>
  </div>
</body></html>"""


def send_booking_email(res: dict, outcome: str, note: str = "") -> dict:
    to = (res.get("email") or "").strip()
    if not to:
        return {"sent": False, "reason": "no guest email on reservation"}

    if outcome in ("success", "confirmed"):
        subject = f"Your table at {res.get('venue','the venue')} is booked"
        html = _confirm_html(res)
        ics = store.to_ics([res]).encode()
    else:
        subject = f"We couldn’t complete your booking at {res.get('venue','the venue')}"
        html = _failed_html(res, note)
        ics = None

    try:
        return _dispatch(to, subject, html, ics)
    except Exception as e:  # never let email failure break a booking
        return {"sent": False, "reason": f"{type(e).__name__}: {e}"}


# ---- providers ----

def _post(url: str, headers: dict, payload: dict) -> dict:
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json", **headers}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        return {"sent": True, "status": r.status}


def _dispatch(to: str, subject: str, html: str, ics: bytes | None) -> dict:
    provider = _provider()
    frm = _from()

    if provider == "console":
        OUTBOX.mkdir(parents=True, exist_ok=True)
        stamp = f"{int(time.time())}_{to.replace('@', '_at_')}"
        (OUTBOX / f"{stamp}.html").write_text(html)
        if ics:
            (OUTBOX / f"{stamp}.ics").write_bytes(ics)
        print(f"[emailer:console] would email {to!r} — subject={subject!r} "
              f"(written to data/outbox/{stamp}.*)")
        return {"sent": True, "provider": "console", "to": to, "outbox": f"{stamp}.html"}

    if provider == "resend":
        payload = {"from": frm, "to": [to], "subject": subject, "html": html}
        if ics:
            payload["attachments"] = [{"filename": "reservation.ics",
                                       "content": base64.b64encode(ics).decode()}]
        return _post("https://api.resend.com/emails",
                     {"Authorization": f"Bearer {os.getenv('RESEND_API_KEY','')}"}, payload)

    if provider == "postmark":
        payload = {"From": frm, "To": to, "Subject": subject, "HtmlBody": html,
                   "MessageStream": "outbound"}
        if ics:
            payload["Attachments"] = [{"Name": "reservation.ics",
                                       "Content": base64.b64encode(ics).decode(),
                                       "ContentType": "text/calendar"}]
        return _post("https://api.postmarkapp.com/email",
                     {"X-Postmark-Server-Token": os.getenv("POSTMARK_API_KEY", "")}, payload)

    if provider == "sendgrid":
        payload = {"personalizations": [{"to": [{"email": to}]}],
                   "from": {"email": frm}, "subject": subject,
                   "content": [{"type": "text/html", "value": html}]}
        if ics:
            payload["attachments"] = [{"filename": "reservation.ics", "type": "text/calendar",
                                       "content": base64.b64encode(ics).decode()}]
        return _post("https://api.sendgrid.com/v3/mail/send",
                     {"Authorization": f"Bearer {os.getenv('SENDGRID_API_KEY','')}"}, payload)

    return {"sent": False, "reason": f"unknown EMAIL_PROVIDER: {provider}"}
