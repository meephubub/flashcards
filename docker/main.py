import imaplib
import email
from email.header import decode_header
from datetime import date
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
        emails.append({
            "subject": decode_str(msg.get("Subject", "(No Subject)")),
            "sender": decode_str(msg.get("From", "")),
            "date": msg.get("Date", ""),
            "body": get_body(msg)[:4000],  # cap to avoid token overflow
        })

    mail.logout()
    return emails


def summarize_email(client: groq.Groq, email_data: dict) -> str:
    """Use Groq to summarize a single email."""
    prompt = f"""Summarize the following email concisely in 2-4 sentences. 
Focus on: the main topic, any action items, and key information.

From: {email_data['sender']}
Subject: {email_data['subject']}
Body:
{email_data['body']}
"""
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
    )
    return response.choices[0].message.content.strip()


def save_to_supabase(supabase: Client, email_data: dict, summary: str):
    """Insert email + summary into Supabase."""
    record = {
        "sender": email_data["sender"],
        "subject": email_data["subject"],
        "received_at": email_data["date"],
        "body_preview": email_data["body"][:500],
        "summary": summary,
    }
    result = supabase.table("email_summaries").insert(record).execute()
    return result


def main():
    groq_client = groq.Groq(api_key=GROQ_API_KEY)
    supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    emails = fetch_todays_emails()

    if not emails:
        print("No emails today. Exiting.")
        return

    for i, em in enumerate(emails, 1):
        print(f"[{i}/{len(emails)}] Summarizing: {em['subject']}")
        try:
            summary = summarize_email(groq_client, em)
            save_to_supabase(supabase_client, em, summary)
            print(f"  ✓ Saved summary: {summary[:80]}...")
        except Exception as e:
            print(f"  ✗ Error processing email '{em['subject']}': {e}")

    print("Done.")


if __name__ == "__main__":
    main()