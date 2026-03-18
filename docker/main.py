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

# Priority levels
PRIORITY_LEVELS = ("critical", "high", "medium", "low")

# Global lock — prevents two simultaneous pipeline runs if pinged twice quickly
_pipeline_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Email helpers
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


def get_body(msg):
    """Extract plain text body from an email message."""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                charset = part.get_content_charset() or "utf-8"
                return part.get_payload(decode=True).decode(charset, errors="replace")
    else:
        charset = msg.get_content_charset() or "utf-8"
        return msg.get_payload(decode=True).decode(charset, errors="replace")
    return ""


def fetch_todays_emails():
    """Connect via IMAP and return list of email dicts from today."""
    today = date.today().strftime("%d-%b-%Y")  # e.g. 17-Mar-2026
    print(f"Fetching emails since {today}...")

    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    mail.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
    mail.select("INBOX")

    _, data = mail.search(None, f'(SINCE "{today}")')
    email_ids = data[0].split()
    print(f"Found {len(email_ids)} emails today.")

    emails = []
    for eid in email_ids:
        _, msg_data = mail.fetch(eid, "(RFC822)")
        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)
        full_body = get_body(msg)
        emails.append({
            "subject": decode_str(msg.get("Subject", "(No Subject)")),
            "sender": decode_str(msg.get("From", "")),
            "date": msg.get("Date", ""),
            "body": full_body,
            "body_truncated": full_body[:4000],  # capped for AI prompts
        })

    mail.logout()
    return emails


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
# Supabase helpers
# ---------------------------------------------------------------------------

def digest_exists_today(supabase: Client) -> bool:
    """Return True if a digest row already exists for today."""
    today = date.today().isoformat()
    result = (
        supabase.table("daily_digests")
        .select("id")
        .eq("date", today)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def save_email(supabase: Client, email_data: dict, analysis: dict):
    """Insert a single email with its analysis."""
    record = {
        "sender": email_data["sender"],
        "subject": email_data["subject"],
        "received_at": email_data["date"],
        "body": email_data["body"],
        "summary": analysis["summary"],
        "priority": analysis["priority"],
        "priority_reason": analysis["priority_reason"],
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
    Fetch, analyse, and store today's emails + digest.
    Returns a status dict sent back as the HTTP response body.
    Idempotent — skips silently if today's digest already exists.
    """
    groq_client = groq.Groq(api_key=GROQ_API_KEY)
    supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # --- Idempotency gate ---
    if digest_exists_today(supabase_client):
        msg = f"Digest for {date.today().isoformat()} already exists. Skipping."
        print(msg)
        return {"status": "skipped", "reason": msg}

    emails = fetch_todays_emails()
    if not emails:
        msg = "No emails today."
        print(msg)
        # Write an empty digest so subsequent pings don't re-run
        save_daily_digest(supabase_client, msg, 0)
        return {"status": "done", "emails_processed": 0, "message": msg}

    analyses = []
    saved = 0
    for i, em in enumerate(emails, 1):
        print(f"[{i}/{len(emails)}] Analysing: {em['subject']}")
        try:
            analysis = analyse_email(groq_client, em)
            row_id = save_email(supabase_client, em, analysis)
            analyses.append(analysis)
            saved += 1
            print(f"  ✓ [{analysis['priority'].upper()}] id={row_id}: {analysis['summary'][:80]}...")
        except Exception as e:
            print(f"  ✗ Error processing '{em['subject']}': {e}")
            analyses.append({"summary": "", "priority": "medium", "priority_reason": ""})

    print("\nGenerating daily digest...")
    digest = generate_daily_digest(groq_client, emails, analyses)
    save_daily_digest(supabase_client, digest, saved)
    print(f"  ✓ Digest saved:\n\n{digest}\n")

    return {"status": "done", "emails_processed": saved, "digest": digest}


# ---------------------------------------------------------------------------
# HTTP server
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    """
    GET /     → health check (Render uses this to confirm the service is up)
    GET /run  → trigger the pipeline if no digest exists for today
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
            # Health check — Render pings this to decide if the service is healthy
            self._send_json(200, {"status": "ok", "date": date.today().isoformat()})

        elif self.path == "/run":
            # Non-blocking lock acquire — returns 409 if a run is already in progress
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
