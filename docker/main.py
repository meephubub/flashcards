import imaplib
import email
import json
import re
from email.header import decode_header
from datetime import date, datetime, timezone
import os
import groq
from supabase import create_client, Client

# --- Config from environment ---
IMAP_HOST = os.environ["IMAP_HOST"]  # e.g. imap.gmail.com
IMAP_PORT = int(os.environ.get("IMAP_PORT", 993))
EMAIL_ADDRESS = os.environ["EMAIL_ADDRESS"]
EMAIL_PASSWORD = os.environ["EMAIL_PASSWORD"]  # App password for Gmail
GROQ_API_KEY = os.environ["GROQ_API_KEY"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama3-8b-8192")

# Priority levels
PRIORITY_LEVELS = ("critical", "high", "medium", "low")


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
        emails.append(
            {
                "subject": decode_str(msg.get("Subject", "(No Subject)")),
                "sender": decode_str(msg.get("From", "")),
                "date": msg.get("Date", ""),
                "body": full_body,  # full body stored in DB
                "body_truncated": full_body[:4000],  # capped version for AI prompts
            }
        )

    mail.logout()
    return emails


def analyse_email(client: groq.Groq, email_data: dict) -> dict:
    """
    Use Groq to summarize a single email AND assign a priority.
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

From: {email_data["sender"]}
Subject: {email_data["subject"]}
Body:
{email_data["body_truncated"]}
"""
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
    )
    raw = response.choices[0].message.content.strip()

    # Strip accidental markdown fences if model ignores instructions
    raw = re.sub(r"^```[a-z]*\n?", "", raw).rstrip("`").strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: store raw text so nothing is lost
        parsed = {
            "summary": raw,
            "priority": "medium",
            "priority_reason": "Could not parse structured response.",
        }

    # Normalise priority to known values
    parsed["priority"] = parsed.get("priority", "medium").lower()
    if parsed["priority"] not in PRIORITY_LEVELS:
        parsed["priority"] = "medium"

    return parsed


def generate_daily_digest(
    client: groq.Groq, emails: list[dict], analyses: list[dict]
) -> str:
    """
    Ask Groq for a concise overall summary of the whole day's inbox.
    """
    if not emails:
        return ""

    email_lines = []
    for em, an in zip(emails, analyses):
        email_lines.append(
            f"- [{an['priority'].upper()}] {em['subject']} (from {em['sender']}): {an['summary']}"
        )

    inbox_overview = "\n".join(email_lines)

    prompt = f"""You are an executive assistant. Below is a bullet-point overview of all emails received today.

{inbox_overview}

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


def save_email(supabase: Client, email_data: dict, analysis: dict) -> str:
    """Insert a single email with its analysis. Returns the new row id."""
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
    """Insert the overall daily digest into its own table."""
    record = {
        "date": date.today().isoformat(),
        "email_count": email_count,
        "digest": digest,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("daily_digests").insert(record).execute()


def main():
    groq_client = groq.Groq(api_key=GROQ_API_KEY)
    supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    emails = fetch_todays_emails()

    if not emails:
        print("No emails today. Exiting.")
        return

    analyses = []
    for i, em in enumerate(emails, 1):
        print(f"[{i}/{len(emails)}] Analysing: {em['subject']}")
        try:
            analysis = analyse_email(groq_client, em)
            row_id = save_email(supabase_client, em, analysis)
            analyses.append(analysis)
            print(
                f"  ✓ [{analysis['priority'].upper()}] saved (id={row_id}): {analysis['summary'][:80]}..."
            )
        except Exception as e:
            print(f"  ✗ Error processing '{em['subject']}': {e}")
            analyses.append(
                {"summary": "", "priority": "medium", "priority_reason": ""}
            )

    print("\nGenerating daily digest...")
    try:
        digest = generate_daily_digest(groq_client, emails, analyses)
        save_daily_digest(supabase_client, digest, len(emails))
        print(f"  ✓ Digest saved:\n\n{digest}\n")
    except Exception as e:
        print(f"  ✗ Error generating digest: {e}")

    print("Done.")


if __name__ == "__main__":
    main()
