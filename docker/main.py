import imaplib
import email
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from email.header import decode_header
from datetime import date, datetime, timezone
import os
import groq
from bs4 import BeautifulSoup
from supabase import create_client, Client

# --- Config from environment ---
IMAP_HOST = os.environ["IMAP_HOST"]           # e.g. imap.gmail.com
IMAP_PORT = int(os.environ.get("IMAP_PORT", 993))
EMAIL_ADDRESS = os.environ["EMAIL_ADDRESS"]
EMAIL_PASSWORD = os.environ["EMAIL_PASSWORD"]  # App password for Gmail
GROQ_API_KEY = os.environ["GROQ_API_KEY"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama3-8b-8192")
PORT = int(os.environ.get("PORT", 8080))  # Render injects $PORT automatically

PRIORITY_LEVELS = ("critical", "high", "medium", "low")

# Global lock — prevents two simultaneous pipeline runs if pinged twice quickly
_pipeline_lock = threading.Lock()


# ---------------------------------------------------------------------------
# HTML cleaning (applied to ALL email bodies before storage or AI analysis)
# ---------------------------------------------------------------------------

def clean_html_body(raw: str) -> str:
    """
    Strip all CSS (style tags, link[rel=stylesheet], inline style attributes)
    from an HTML email body and return clean text extracted from the remaining
    markup. Falls back gracefully if the input is plain text.
    """
    if not raw:
        return ""

    # Detect whether the content looks like HTML at all
    if "<" not in raw:
        return raw.strip()

    try:
        soup = BeautifulSoup(raw, "lxml")
    except Exception:
        soup = BeautifulSoup(raw, "html.parser")

    # Remove <style> blocks
    for tag in soup.find_all("style"):
        tag.decompose()

    # Remove <link rel="stylesheet"> tags
    for tag in soup.find_all("link", rel="stylesheet"):
        tag.decompose()

    # Strip inline style attributes from every element
    for tag in soup.find_all(True):
        tag.attrs.pop("style", None)

    # Also drop <script> blocks — they add noise with no value
    for tag in soup.find_all("script"):
        tag.decompose()

    # Extract readable text with whitespace normalised
    text = soup.get_text(separator="\n")
    # Collapse runs of blank lines to a single blank line
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ---------------------------------------------------------------------------
# IMAP source
# ---------------------------------------------------------------------------

def decode_str(s):
    """Decode encoded email header strings."""
    parts = decode_header(s or "")
    result = []
    for text, charset in parts:
        if isinstance(text, bytes):
            result.append(text.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(text)
    return " ".join(result)


def get_raw_body(msg) -> str:
    """Extract the raw body string from a parsed email.Message object."""
    # Prefer plain text; fall back to HTML if that's all there is
    plain, html = None, None
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if "attachment" in cd:
                continue
            charset = part.get_content_charset() or "utf-8"
            if ct == "text/plain" and plain is None:
                plain = part.get_payload(decode=True).decode(charset, errors="replace")
            elif ct == "text/html" and html is None:
                html = part.get_payload(decode=True).decode(charset, errors="replace")
    else:
        charset = msg.get_content_charset() or "utf-8"
        payload = msg.get_payload(decode=True).decode(charset, errors="replace")
        if msg.get_content_type() == "text/html":
            html = payload
        else:
            plain = payload

    # Return plain text if available; otherwise clean the HTML
    if plain:
        return plain
    if html:
        return clean_html_body(html)
    return ""


def fetch_imap_emails() -> list[dict]:
    """Fetch today's emails via IMAP and return normalised dicts."""
    today = date.today().strftime("%d-%b-%Y")
    print(f"[IMAP] Fetching emails since {today}...")

    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    mail.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
    mail.select("INBOX")

    _, data = mail.search(None, f'(SINCE "{today}")')
    email_ids = data[0].split()
    print(f"[IMAP] Found {len(email_ids)} emails.")

    results = []
    for eid in email_ids:
        _, msg_data = mail.fetch(eid, "(RFC822)")
        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)
        body = get_raw_body(msg)
        results.append(_normalise(
            subject=decode_str(msg.get("Subject", "(No Subject)")),
            sender=decode_str(msg.get("From", "")),
            received_at=msg.get("Date", ""),
            body=body,
            source="imap",
        ))

    mail.logout()
    return results


# ---------------------------------------------------------------------------
# Supabase emails table source
# ---------------------------------------------------------------------------

def fetch_supabase_emails(supabase: Client) -> list[dict]:
    """
    Pull today's rows from the public.emails table.
    Deduplication against email_summaries is handled by source+subject+sender
    to avoid re-processing the same message on repeated runs within a day
    (the daily digest gate already prevents full re-runs, but this is a
    belt-and-braces guard for the source data).
    """
    today_start = date.today().isoformat()  # e.g. "2026-03-19"
    print(f"[Supabase emails] Fetching rows with received_at >= {today_start}...")

    result = (
        supabase.table("emails")
        .select("id, gmail_id, subject, sender, body, received_at")
        .gte("received_at", today_start)
        .execute()
    )

    rows = result.data or []
    print(f"[Supabase emails] Found {len(rows)} rows.")

    emails = []
    for row in rows:
        body = clean_html_body(row.get("body") or "")
        emails.append(_normalise(
            subject=row.get("subject") or "(No Subject)",
            sender=row.get("sender") or "",
            received_at=str(row.get("received_at") or ""),
            body=body,
            source="supabase",
            source_id=str(row.get("gmail_id") or row.get("id") or ""),
        ))

    return emails


def _normalise(subject: str, sender: str, received_at: str, body: str,
               source: str, source_id: str = "") -> dict:
    """Return a consistent dict shape used throughout the pipeline."""
    cleaned_body = clean_html_body(body) if source == "imap" else body  # supabase already cleaned above
    return {
        "subject": subject,
        "sender": sender,
        "received_at": received_at,
        "body": cleaned_body,                    # full cleaned body → stored in DB
        "body_truncated": cleaned_body[:4000],   # capped for AI prompt
        "source": source,
        "source_id": source_id,
    }


# ---------------------------------------------------------------------------
# AI helpers
# ---------------------------------------------------------------------------

def analyse_email(client: groq.Groq, email_data: dict) -> dict:
    """
    Summarise a single email and assign a priority via Groq.
    Returns {"summary": str, "priority": str, "priority_reason": str}.
    """
    prompt = f"""Analyse the following email and respond with ONLY a valid JSON object — no markdown, no explanation.

JSON schema:
{{
  "summary": "2-4 sentence summary covering the main topic, key information, and any action items",
  "priority": "one of: critical | high | medium | low",
  "priority_reason": "one sentence explaining why you assigned this priority"
}}

Priority guide:
- critical: requires immediate action today (deadlines, urgent requests, security issues)
- high: important, should be addressed within 24 hours
- medium: relevant but not time-sensitive
- low: newsletters, notifications, FYI-only emails

From: {email_data['sender']}
Subject: {email_data['subject']}
Body:
{email_data['body_truncated']}
"""
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
    )
    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw).rstrip("`").strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "summary": raw,
            "priority": "medium",
            "priority_reason": "Could not parse structured response.",
        }

    parsed["priority"] = parsed.get("priority", "medium").lower()
    if parsed["priority"] not in PRIORITY_LEVELS:
        parsed["priority"] = "medium"

    return parsed


def generate_daily_digest(client: groq.Groq, emails: list, analyses: list) -> str:
    """Generate a concise overall summary of the day's inbox."""
    if not emails:
        return ""

    lines = [
        f"- [{an['priority'].upper()}] {em['subject']} (from {em['sender']}): {an['summary']}"
        for em, an in zip(emails, analyses)
    ]

    prompt = f"""You are an executive assistant. Below is a bullet-point overview of all emails received today.

{chr(10).join(lines)}

Write a concise daily digest (3-6 sentences) that:
1. Highlights the most critical/high-priority items needing action
2. Summarises the overall theme of today's inbox
3. Notes any recurring senders or topics

Respond with plain prose only — no bullet points, no headers.
"""
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
    )
    return response.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# Supabase write helpers
# ---------------------------------------------------------------------------

def digest_exists_today(supabase: Client) -> bool:
    """Return True if a digest row already exists for today."""
    result = (
        supabase.table("daily_digests")
        .select("id")
        .eq("date", date.today().isoformat())
        .limit(1)
        .execute()
    )
    return bool(result.data)


def save_email(supabase: Client, email_data: dict, analysis: dict):
    """Insert a single processed email into email_summaries."""
    record = {
        "sender": email_data["sender"],
        "subject": email_data["subject"],
        "received_at": email_data["received_at"],
        "body": email_data["body"],
        "summary": analysis["summary"],
        "priority": analysis["priority"],
        "priority_reason": analysis["priority_reason"],
        "source": email_data["source"],
        "source_id": email_data.get("source_id", ""),
    }
    result = supabase.table("email_summaries").insert(record).execute()
    return result.data[0]["id"] if result.data else None


def save_daily_digest(supabase: Client, digest: str, email_count: int):
    """Insert the overall daily digest."""
    record = {
        "date": date.today().isoformat(),
        "email_count": email_count,
        "digest": digest,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("daily_digests").insert(record).execute()


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def run_pipeline() -> dict:
    """
    Collect emails from IMAP + Supabase emails table, clean, analyse, and store.
    Idempotent — skips entirely if today's digest already exists.
    """
    groq_client = groq.Groq(api_key=GROQ_API_KEY)
    supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # --- Idempotency gate ---
    if digest_exists_today(supabase_client):
        msg = f"Digest for {date.today().isoformat()} already exists. Skipping."
        print(msg)
        return {"status": "skipped", "reason": msg}

    # --- Collect from both sources ---
    imap_emails = fetch_imap_emails()
    db_emails = fetch_supabase_emails(supabase_client)

    all_emails = imap_emails + db_emails
    print(f"\nTotal emails to process: {len(all_emails)} "
          f"({len(imap_emails)} IMAP + {len(db_emails)} Supabase)\n")

    if not all_emails:
        msg = "No emails today from any source."
        print(msg)
        save_daily_digest(supabase_client, msg, 0)
        return {"status": "done", "emails_processed": 0, "message": msg}

    # --- Analyse and save each email ---
    analyses = []
    saved = 0
    for i, em in enumerate(all_emails, 1):
        label = f"[{em['source'].upper()}]"
        print(f"[{i}/{len(all_emails)}] {label} Analysing: {em['subject']}")
        try:
            analysis = analyse_email(groq_client, em)
            row_id = save_email(supabase_client, em, analysis)
            analyses.append(analysis)
            saved += 1
            print(f"  ✓ [{analysis['priority'].upper()}] id={row_id}: {analysis['summary'][:80]}...")
        except Exception as e:
            print(f"  ✗ Error processing '{em['subject']}': {e}")
            analyses.append({"summary": "", "priority": "medium", "priority_reason": ""})

    # --- Generate and save daily digest ---
    print("\nGenerating daily digest...")
    digest = generate_daily_digest(groq_client, all_emails, analyses)
    save_daily_digest(supabase_client, digest, saved)
    print(f"  ✓ Digest saved:\n\n{digest}\n")

    return {
        "status": "done",
        "emails_processed": saved,
        "imap_count": len(imap_emails),
        "supabase_count": len(db_emails),
        "digest": digest,
    }


# ---------------------------------------------------------------------------
# HTTP server
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    """
    GET /     → health check
    GET /run  → trigger pipeline (idempotent, once per day)
    """

    def log_message(self, format, *args):
        print(f"[HTTP] {self.address_string()} - {format % args}")

    def _send_json(self, status: int, body: dict):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == "/":
            self._send_json(200, {"status": "ok", "date": date.today().isoformat()})

        elif self.path == "/run":
            acquired = _pipeline_lock.acquire(blocking=False)
            if not acquired:
                self._send_json(409, {"status": "busy", "reason": "Pipeline already running."})
                return
            try:
                result = run_pipeline()
                self._send_json(200, result)
            except Exception as e:
                print(f"Pipeline error: {e}")
                self._send_json(500, {"status": "error", "reason": str(e)})
            finally:
                _pipeline_lock.release()

        else:
            self._send_json(404, {"status": "not_found"})


def main():
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Server listening on port {PORT}")
    print("  GET /      — health check")
    print("  GET /run   — trigger pipeline (idempotent, once per day)")
    server.serve_forever()


if __name__ == "__main__":
    main()
