import imaplib
import email
import json
import logging
import re
import threading
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from email.header import decode_header
from datetime import date, datetime, timezone
from logging.handlers import RotatingFileHandler
from urllib.parse import urlparse, parse_qs
import os
import groq
from bs4 import BeautifulSoup
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

IMAP_HOST     = os.environ["IMAP_HOST"]
IMAP_PORT     = int(os.environ.get("IMAP_PORT", 993))
EMAIL_ADDRESS = os.environ["EMAIL_ADDRESS"]
EMAIL_PASSWORD = os.environ["EMAIL_PASSWORD"]
GROQ_API_KEY  = os.environ["GROQ_API_KEY"]
SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_KEY"]
GROQ_MODEL    = os.environ.get("GROQ_MODEL", "llama3-8b-8192")
PORT          = int(os.environ.get("PORT", 8080))
IS_DEV        = os.environ.get("ENVIRONMENT", "").lower() == "dev"

PRIORITY_LEVELS = ("critical", "high", "medium", "low")

_pipeline_lock = threading.Lock()

LOG_PATH = os.environ.get("LOG_PATH", "app.log")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def _build_logger() -> logging.Logger:
    """
    Returns a logger that writes to both stderr and a rotating log file.
    The file rotates at 5 MB and keeps 3 backups, so total disk use is capped
    at ~20 MB regardless of how long the container runs.
    """
    logger = logging.getLogger("email_summariser")
    logger.setLevel(logging.DEBUG)

    fmt = logging.Formatter(
        fmt="%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler — INFO and above (keeps Render log output clean)
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)

    # File handler — DEBUG and above (full detail for debugging)
    fh = RotatingFileHandler(
        LOG_PATH,
        maxBytes=5 * 1024 * 1024,   # 5 MB per file
        backupCount=3,
        encoding="utf-8",
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)

    logger.addHandler(ch)
    logger.addHandler(fh)
    return logger


log = _build_logger()


# ---------------------------------------------------------------------------
# HTML → plain text cleaning
# ---------------------------------------------------------------------------

def clean_body(raw: str) -> str:
    """
    If the string contains HTML, strip all style/script noise and return
    readable plain text.  Plain-text input passes through unchanged.
    """
    if not raw:
        return ""

    # Quick heuristic: if there are no angle brackets, treat as plain text
    if "<" not in raw:
        return raw.strip()

    try:
        soup = BeautifulSoup(raw, "lxml")
    except Exception:
        soup = BeautifulSoup(raw, "html.parser")

    # Remove noise elements entirely
    for tag in soup.find_all(["style", "script", "head"]):
        tag.decompose()
    for tag in soup.find_all("link", rel=lambda v: v and "stylesheet" in v):
        tag.decompose()

    # Strip inline style attributes
    for tag in soup.find_all(True):
        tag.attrs.pop("style", None)

    text = soup.get_text(separator="\n")
    # Collapse 3+ consecutive newlines → 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ---------------------------------------------------------------------------
# IMAP helpers
# ---------------------------------------------------------------------------

def decode_mime_str(value: str) -> str:
    """Decode an RFC 2047-encoded email header value."""
    if not value:
        return ""
    parts = decode_header(value)
    out = []
    for fragment, charset in parts:
        if isinstance(fragment, bytes):
            out.append(fragment.decode(charset or "utf-8", errors="replace"))
        else:
            out.append(fragment)
    return " ".join(out).strip()


def extract_body_from_message(msg: email.message.Message) -> str:
    """
    Walk a parsed email.Message and return the best available body.
    Preference order: text/plain → text/html (cleaned).
    For non-multipart messages the single payload is used directly.
    """
    plain: str | None = None
    html:  str | None = None

    if msg.is_multipart():
        for part in msg.walk():
            # Skip attachments
            cd = part.get("Content-Disposition", "") or ""
            if "attachment" in cd.lower():
                continue

            ct = part.get_content_type()
            charset = part.get_content_charset() or "utf-8"

            try:
                raw_bytes = part.get_payload(decode=True)
            except Exception:
                continue
            if not raw_bytes:
                continue

            try:
                decoded = raw_bytes.decode(charset, errors="replace")
            except (LookupError, UnicodeDecodeError):
                decoded = raw_bytes.decode("utf-8", errors="replace")

            if ct == "text/plain" and plain is None:
                plain = decoded
            elif ct == "text/html" and html is None:
                html = decoded
    else:
        charset = msg.get_content_charset() or "utf-8"
        try:
            raw_bytes = msg.get_payload(decode=True)
        except Exception:
            raw_bytes = None

        if raw_bytes:
            try:
                decoded = raw_bytes.decode(charset, errors="replace")
            except (LookupError, UnicodeDecodeError):
                decoded = raw_bytes.decode("utf-8", errors="replace")

            if msg.get_content_type() == "text/html":
                html = decoded
            else:
                plain = decoded

    if plain:
        return clean_body(plain)   # plain may still contain stray HTML tags
    if html:
        return clean_body(html)
    return ""


def fetch_imap_emails() -> list[dict]:
    """Return today's inbox emails as normalised dicts."""
    today_str = date.today().strftime("%d-%b-%Y")   # e.g. "21-Mar-2026"
    print(f"[IMAP] Connecting to {IMAP_HOST}...")

    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        mail.select("INBOX")
    except Exception as e:
        print(f"[IMAP] Connection/login failed: {e}")
        return []

    try:
        status, data = mail.search(None, f'SINCE "{today_str}"')
        if status != "OK":
            print(f"[IMAP] Search returned non-OK status: {status}")
            mail.logout()
            return []

        email_ids = data[0].split() if data[0] else []
        print(f"[IMAP] Found {len(email_ids)} email(s) today.")

        results = []
        for eid in email_ids:
            try:
                status, msg_data = mail.fetch(eid, "(RFC822)")
                if status != "OK" or not msg_data or not msg_data[0]:
                    print(f"[IMAP] Could not fetch email id={eid}")
                    continue

                raw_bytes = msg_data[0][1]
                msg = email.message_from_bytes(raw_bytes)

                subject    = decode_mime_str(msg.get("Subject", "(No Subject)"))
                sender     = decode_mime_str(msg.get("From", ""))
                recv       = msg.get("Date", "")
                body       = extract_body_from_message(msg)

                print(f"[IMAP]   Parsed: {subject!r} | body_len={len(body)}")

                results.append({
                    "subject":      subject,
                    "sender":       sender,
                    "received_at":  recv,
                    "body":         body,
                    "body_truncated": body[:4000],
                    "source":       "imap",
                    "source_id":    "",
                    "db_id":        None,
                })
            except Exception as e:
                print(f"[IMAP] Error parsing email id={eid}: {e}")

        return results

    finally:
        try:
            mail.logout()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Supabase emails table source
# ---------------------------------------------------------------------------

def fetch_supabase_emails(supabase: Client) -> list[dict]:
    """
    Fetch ALL rows from public.emails (no date filter — rows may have been
    inserted at any time and should be processed regardless).
    """
    print("[Supabase emails] Fetching all unprocessed rows...")

    try:
        result = (
            supabase.table("emails")
            .select("id, gmail_id, subject, sender, body, received_at")
            .execute()
        )
        rows = result.data or []
    except Exception as e:
        print(f"[Supabase emails] Fetch error: {e}")
        return []

    print(f"[Supabase emails] Found {len(rows)} row(s).")

    emails = []
    for row in rows:
        raw_body = row.get("body") or ""
        body = clean_body(raw_body)
        print(f"[Supabase emails]   Row id={row['id']} subject={row.get('subject')!r} body_len={len(body)}")
        emails.append({
            "subject":      row.get("subject") or "(No Subject)",
            "sender":       row.get("sender") or "",
            "received_at":  str(row.get("received_at") or ""),
            "body":         body,
            "body_truncated": body[:4000],
            "source":       "supabase",
            "source_id":    str(row.get("gmail_id") or ""),
            "db_id":        row["id"],
        })

    return emails


def delete_supabase_email(supabase: Client, db_id: int):
    """Delete a row from public.emails after it has been successfully saved."""
    try:
        supabase.table("emails").delete().eq("id", db_id).execute()
        print(f"  🗑  Deleted emails row id={db_id}")
    except Exception as e:
        print(f"  ✗ Failed to delete emails row id={db_id}: {e}")


# ---------------------------------------------------------------------------
# AI helpers
# ---------------------------------------------------------------------------

def analyse_email(client: groq.Groq, email_data: dict) -> dict:
    """
    Send a single email to Groq and return structured analysis.
    Returns {"summary": str, "priority": str, "priority_reason": str}.
    All Groq errors are logged in full to the log file.
    """
    subject      = email_data["subject"]
    sender       = email_data["sender"]
    body_preview = email_data["body_truncated"]

    if not body_preview.strip():
        log.warning("Empty body for email | subject=%r sender=%r", subject, sender)

    prompt = f"""Analyse the following email and respond with ONLY a valid JSON object.
No markdown fences, no explanation — just the raw JSON.

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

From: {sender}
Subject: {subject}
Body:
{body_preview}
"""

    log.debug("Groq request | call=analyse_email model=%s subject=%r body_chars=%d",
              GROQ_MODEL, subject, len(body_preview))

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
        )
    except groq.RateLimitError as exc:
        log.error(
            "Groq rate-limit | call=analyse_email model=%s subject=%r\n"
            "  status=%s  message=%s\n%s",
            GROQ_MODEL, subject,
            getattr(exc, "status_code", "?"), exc,
            traceback.format_exc(),
        )
        raise
    except groq.APIStatusError as exc:
        log.error(
            "Groq API error | call=analyse_email model=%s subject=%r\n"
            "  status=%s  body=%s\n%s",
            GROQ_MODEL, subject,
            getattr(exc, "status_code", "?"),
            getattr(exc, "body", str(exc)),
            traceback.format_exc(),
        )
        raise
    except groq.APIConnectionError as exc:
        log.error(
            "Groq connection error | call=analyse_email model=%s subject=%r\n%s",
            GROQ_MODEL, subject, traceback.format_exc(),
        )
        raise
    except Exception as exc:
        log.error(
            "Unexpected Groq error | call=analyse_email model=%s subject=%r\n"
            "  type=%s  error=%s\n%s",
            GROQ_MODEL, subject,
            type(exc).__name__, exc,
            traceback.format_exc(),
        )
        raise

    raw = response.choices[0].message.content.strip()
    log.debug("Groq response | call=analyse_email subject=%r raw_chars=%d raw_preview=%r",
              subject, len(raw), raw[:120])

    # Strip accidental markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw).strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        log.warning(
            "JSON parse failed | call=analyse_email subject=%r\n"
            "  json_error=%s\n  raw_response=%s",
            subject, exc, raw,
        )
        parsed = {
            "summary": raw or "(no summary)",
            "priority": "medium",
            "priority_reason": "Could not parse structured response.",
        }

    # Normalise priority
    parsed["priority"] = str(parsed.get("priority", "medium")).lower().strip()
    if parsed["priority"] not in PRIORITY_LEVELS:
        log.warning("Unexpected priority value %r for subject=%r — defaulting to medium",
                    parsed["priority"], subject)
        parsed["priority"] = "medium"

    parsed.setdefault("summary", "(no summary)")
    parsed.setdefault("priority_reason", "")

    log.info("Groq OK | call=analyse_email subject=%r priority=%s",
             subject, parsed["priority"])
    return parsed


def generate_daily_digest(client: groq.Groq, emails: list, analyses: list) -> str:
    """Generate a concise overall summary of the day's inbox."""
    lines = [
        f"- [{an['priority'].upper()}] {em['subject']} (from {em['sender']}): {an['summary']}"
        for em, an in zip(emails, analyses)
        if an.get("summary") and an["summary"] != "(no summary)"
    ]

    if not lines:
        log.warning("generate_daily_digest: no valid summaries to digest")
        return "No emails were successfully summarised today."

    prompt = f"""You are an executive assistant. Below is a list of all emails received today.

{chr(10).join(lines)}

Write a concise daily digest (3-6 sentences) that:
1. Highlights the most critical/high-priority items needing action
2. Summarises the overall theme of today's inbox
3. Notes any recurring senders or topics

Respond with plain prose only — no bullet points, no headers.
"""

    log.debug("Groq request | call=generate_daily_digest model=%s email_count=%d",
              GROQ_MODEL, len(lines))

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
        )
    except groq.RateLimitError as exc:
        log.error(
            "Groq rate-limit | call=generate_daily_digest model=%s\n"
            "  status=%s  message=%s\n%s",
            GROQ_MODEL,
            getattr(exc, "status_code", "?"), exc,
            traceback.format_exc(),
        )
        raise
    except groq.APIStatusError as exc:
        log.error(
            "Groq API error | call=generate_daily_digest model=%s\n"
            "  status=%s  body=%s\n%s",
            GROQ_MODEL,
            getattr(exc, "status_code", "?"),
            getattr(exc, "body", str(exc)),
            traceback.format_exc(),
        )
        raise
    except groq.APIConnectionError as exc:
        log.error(
            "Groq connection error | call=generate_daily_digest model=%s\n%s",
            GROQ_MODEL, traceback.format_exc(),
        )
        raise
    except Exception as exc:
        log.error(
            "Unexpected Groq error | call=generate_daily_digest model=%s\n"
            "  type=%s  error=%s\n%s",
            GROQ_MODEL, type(exc).__name__, exc,
            traceback.format_exc(),
        )
        raise

    result = response.choices[0].message.content.strip()
    log.info("Groq OK | call=generate_daily_digest chars=%d", len(result))
    return result


# ---------------------------------------------------------------------------
# Supabase write helpers
# ---------------------------------------------------------------------------

def digest_exists_today(supabase: Client) -> bool:
    result = (
        supabase.table("daily_digests")
        .select("id")
        .eq("date", date.today().isoformat())
        .limit(1)
        .execute()
    )
    return bool(result.data)


def delete_todays_digest(supabase: Client):
    """Remove today's digest row so a forced re-run can insert a fresh one."""
    supabase.table("daily_digests").delete().eq("date", date.today().isoformat()).execute()
    print("[Force] Deleted existing digest for today.")


def save_email_summary(supabase: Client, email_data: dict, analysis: dict) -> int | None:
    record = {
        "sender":          email_data["sender"],
        "subject":         email_data["subject"],
        "received_at":     email_data["received_at"],
        "body":            email_data["body"],
        "summary":         analysis["summary"],
        "priority":        analysis["priority"],
        "priority_reason": analysis["priority_reason"],
        "source":          email_data["source"],
        "source_id":       email_data.get("source_id", ""),
    }
    result = supabase.table("email_summaries").insert(record).execute()
    return result.data[0]["id"] if result.data else None


def save_daily_digest(supabase: Client, digest: str, email_count: int):
    record = {
        "date":          date.today().isoformat(),
        "email_count":   email_count,
        "digest":        digest,
        "generated_at":  datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("daily_digests").insert(record).execute()


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def run_pipeline(force: bool = False) -> dict:
    """
    Collect emails from IMAP + Supabase emails table, clean bodies,
    analyse with Groq, store summaries, delete processed Supabase rows,
    and generate a daily digest.

    force=True  bypasses the idempotency check (for testing).
    """
    groq_client      = groq.Groq(api_key=GROQ_API_KEY)
    supabase_client  = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Idempotency gate
    if digest_exists_today(supabase_client):
        if not force:
            msg = (
                f"Digest for {date.today().isoformat()} already exists. "
                "Use ?force=true to override."
            )
            print(msg)
            return {"status": "skipped", "reason": msg}
        delete_todays_digest(supabase_client)

    # Collect
    imap_emails = fetch_imap_emails()
    db_emails   = fetch_supabase_emails(supabase_client)
    all_emails  = imap_emails + db_emails

    print(
        f"\nTotal to process: {len(all_emails)} "
        f"({len(imap_emails)} IMAP + {len(db_emails)} Supabase)\n"
    )

    if not all_emails:
        msg = "No emails found from any source."
        print(msg)
        save_daily_digest(supabase_client, msg, 0)
        return {"status": "done", "emails_processed": 0, "message": msg}

    # Analyse and save
    analyses = []
    saved    = 0
    for i, em in enumerate(all_emails, 1):
        print(f"[{i}/{len(all_emails)}] [{em['source'].upper()}] {em['subject']!r}")
        try:
            analysis = analyse_email(groq_client, em)
            row_id   = save_email_summary(supabase_client, em, analysis)
            analyses.append(analysis)
            saved += 1
            print(
                f"  ✓ [{analysis['priority'].upper()}] "
                f"saved id={row_id}: {analysis['summary'][:80]}..."
            )

            # Delete source row only after summary is safely stored
            if em["source"] == "supabase" and em.get("db_id"):
                delete_supabase_email(supabase_client, em["db_id"])

        except Exception as e:
            print(f"  ✗ Error processing {em['subject']!r}: {e}")
            analyses.append({"summary": "", "priority": "medium", "priority_reason": ""})

    # Daily digest
    print("\nGenerating daily digest...")
    try:
        digest = generate_daily_digest(groq_client, all_emails, analyses)
        save_daily_digest(supabase_client, digest, saved)
        print(f"  ✓ Digest saved:\n\n{digest}\n")
    except Exception as e:
        digest = ""
        print(f"  ✗ Digest generation failed: {e}")

    return {
        "status":          "done",
        "force":           force,
        "emails_processed": saved,
        "imap_count":      len(imap_emails),
        "supabase_count":  len(db_emails),
        "digest":          digest,
    }



# ---------------------------------------------------------------------------
# Dev UI  (only served when ENVIRONMENT=dev)
# ---------------------------------------------------------------------------

DEV_UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email Summariser — Dev Console</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f1117;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }

    header {
      width: 100%;
      max-width: 760px;
      margin-bottom: 2rem;
    }

    header h1 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.01em;
    }

    header p {
      font-size: 0.82rem;
      color: #64748b;
      margin-top: 0.25rem;
    }

    .dev-badge {
      display: inline-block;
      background: #854d0e;
      color: #fef08a;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-left: 0.6rem;
      vertical-align: middle;
    }

    .card {
      background: #1e2330;
      border: 1px solid #2d3448;
      border-radius: 12px;
      padding: 1.5rem;
      width: 100%;
      max-width: 760px;
      margin-bottom: 1.25rem;
    }

    .card h2 {
      font-size: 0.9rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 1rem;
    }

    .btn-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }

    button {
      cursor: pointer;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.6rem 1.25rem;
      transition: opacity 0.15s, transform 0.1s;
    }
    button:active { transform: scale(0.97); }
    button:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-primary   { background: #4f46e5; color: #fff; }
    .btn-warning   { background: #b45309; color: #fff; }
    .btn-secondary { background: #2d3448; color: #e2e8f0; border: 1px solid #3d4560; }

    .status-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 1rem;
    }

    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #64748b;
      flex-shrink: 0;
    }
    .dot.running { background: #f59e0b; animation: pulse 1s infinite; }
    .dot.ok      { background: #22c55e; }
    .dot.error   { background: #ef4444; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }

    pre {
      background: #0d1117;
      border: 1px solid #2d3448;
      border-radius: 8px;
      padding: 1rem;
      font-size: 0.78rem;
      line-height: 1.6;
      color: #a5f3fc;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 420px;
      overflow-y: auto;
    }

    .hidden { display: none; }

    .digest-box {
      background: #0d1117;
      border-left: 3px solid #4f46e5;
      border-radius: 0 8px 8px 0;
      padding: 1rem 1.25rem;
      font-size: 0.875rem;
      line-height: 1.7;
      color: #cbd5e1;
      margin-top: 0.75rem;
    }

    .meta-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; }
    .pill {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      border-radius: 99px;
      background: #2d3448;
      color: #94a3b8;
    }
    .pill.ok    { background: #14532d; color: #86efac; }
    .pill.skip  { background: #1e3a5f; color: #93c5fd; }
    .pill.error { background: #450a0a; color: #fca5a5; }
  </style>
</head>
<body>

<header>
  <h1>Email Summariser <span class="dev-badge">dev</span></h1>
  <p>Internal testing console &mdash; not available in production.</p>
</header>

<div class="card">
  <h2>Pipeline</h2>
  <div class="btn-row">
    <button class="btn-primary"   id="btnRun">▶ Run pipeline</button>
    <button class="btn-warning"   id="btnForce">⚡ Force re-run (ignore today&apos;s digest)</button>
    <button class="btn-secondary" id="btnHealth">⬡ Health check</button>
    <button class="btn-secondary" id="btnLogs">📄 View logs</button>
  </div>
  <div class="status-row">
    <span class="dot" id="dot"></span>
    <span id="statusText">Idle</span>
  </div>
</div>

<div class="card hidden" id="resultCard">
  <h2>Result</h2>
  <div class="meta-pills" id="metaPills"></div>
  <div class="digest-box hidden" id="digestBox"></div>
  <pre id="rawJson"></pre>
</div>

<div class="card hidden" id="logCard">
  <h2>Log tail <span id="logMeta" style="font-weight:400;color:#475569;text-transform:none;letter-spacing:0"></span></h2>
  <pre id="logPre" style="color:#a3e635"></pre>
</div>

<script>
  const dot        = document.getElementById("dot");
  const statusText = document.getElementById("statusText");
  const resultCard = document.getElementById("resultCard");
  const rawJson    = document.getElementById("rawJson");
  const digestBox  = document.getElementById("digestBox");
  const metaPills  = document.getElementById("metaPills");

  function setStatus(state, text) {
    dot.className = "dot " + state;
    statusText.textContent = text;
  }

  function pill(label, cls) {
    const el = document.createElement("span");
    el.className = "pill " + (cls || "");
    el.textContent = label;
    return el;
  }

  async function callApi(url) {
    setStatus("running", "Running…");
    ["btnRun","btnForce","btnHealth"].forEach(id =>
      document.getElementById(id).disabled = true
    );
    resultCard.classList.add("hidden");
    digestBox.classList.add("hidden");
    metaPills.innerHTML = "";

    try {
      const res  = await fetch(url);
      const data = await res.json();

      rawJson.textContent = JSON.stringify(data, null, 2);
      resultCard.classList.remove("hidden");

      // Status pill
      const s = data.status || "unknown";
      metaPills.appendChild(pill(s.toUpperCase(), s === "done" ? "ok" : s === "skipped" ? "skip" : "error"));

      if (data.emails_processed !== undefined)
        metaPills.appendChild(pill(data.emails_processed + " processed"));
      if (data.imap_count !== undefined)
        metaPills.appendChild(pill(data.imap_count + " IMAP"));
      if (data.supabase_count !== undefined)
        metaPills.appendChild(pill(data.supabase_count + " Supabase"));
      if (data.force)
        metaPills.appendChild(pill("forced", "skip"));

      if (data.digest && data.digest.length > 10) {
        digestBox.textContent = data.digest;
        digestBox.classList.remove("hidden");
      }

      setStatus(s === "done" || s === "ok" || s === "skipped" ? "ok" : "error",
                s === "done" ? "Done" : s === "skipped" ? "Skipped" : s === "ok" ? "Healthy" : "Error");

    } catch (err) {
      rawJson.textContent = "Request failed: " + err.message;
      resultCard.classList.remove("hidden");
      setStatus("error", "Request failed");
    } finally {
      ["btnRun","btnForce","btnHealth"].forEach(id =>
        document.getElementById(id).disabled = false
      );
    }
  }

  document.getElementById("btnRun")   .addEventListener("click", () => callApi("/run"));
  document.getElementById("btnForce") .addEventListener("click", () => callApi("/run?force=true"));
  document.getElementById("btnHealth").addEventListener("click", () => callApi("/"));
  document.getElementById("btnLogs")  .addEventListener("click", async () => {
    const logCard = document.getElementById("logCard");
    const logPre  = document.getElementById("logPre");
    const logMeta = document.getElementById("logMeta");
    setStatus("running", "Fetching logs\u2026");
    try {
      const res  = await fetch("/logs?lines=300");
      const text = await res.text();
      logPre.textContent = text;
      logMeta.textContent = "— last 300 lines";
      logCard.classList.remove("hidden");
      logPre.scrollTop = logPre.scrollHeight;
      setStatus("ok", "Done");
    } catch(err) {
      logPre.textContent = "Failed to fetch logs: " + err.message;
      logCard.classList.remove("hidden");
      setStatus("error", "Error");
    }
  });
</script>
</body>
</html>"""


# ---------------------------------------------------------------------------
# HTTP server
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    """
    GET /                → dev UI (ENVIRONMENT=dev) or health check JSON
    GET /run             → run pipeline (skips if digest already exists today)
    GET /run?force=true  → force re-run (deletes today's digest first)
    """

    def log_message(self, fmt, *args):
        print(f"[HTTP] {self.address_string()} - {fmt % args}")

    def _send_json(self, status: int, body: dict):
        payload = json.dumps(body, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_html(self, status: int, html: str):
        payload = html.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/":
            if IS_DEV:
                self._send_html(200, DEV_UI_HTML)
            else:
                self._send_json(200, {"status": "ok", "date": date.today().isoformat()})

        elif parsed.path == "/run":
            qs    = parse_qs(parsed.query)
            force = qs.get("force", ["false"])[0].lower() == "true"

            acquired = _pipeline_lock.acquire(blocking=False)
            if not acquired:
                self._send_json(409, {"status": "busy", "reason": "Pipeline already running."})
                return
            try:
                result = run_pipeline(force=force)
                self._send_json(200, result)
            except Exception as e:
                log.error("Pipeline unhandled error:\n%s", traceback.format_exc())
                self._send_json(500, {"status": "error", "reason": str(e)})
            finally:
                _pipeline_lock.release()

        elif parsed.path == "/logs":
            # Dev-only: tail the last N lines of the log file
            if not IS_DEV:
                self._send_json(403, {"status": "forbidden"})
                return
            qs    = parse_qs(parsed.query)
            lines = int(qs.get("lines", ["200"])[0])
            try:
                with open(LOG_PATH, "r", encoding="utf-8", errors="replace") as lf:
                    all_lines = lf.readlines()
                tail = "".join(all_lines[-lines:])
            except FileNotFoundError:
                tail = "(log file not yet created)"
            payload = tail.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        else:
            self._send_json(404, {"status": "not_found"})


def main():
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Server listening on port {PORT}")
    print(f"  ENVIRONMENT = {'dev — UI enabled at /' if IS_DEV else 'production'}")
    print("  GET /                — dev UI (dev) / health check (prod)")
    print("  GET /run             — run pipeline (once per day)")
    print("  GET /run?force=true  — force re-run, ignoring today's digest")
    server.serve_forever()


if __name__ == "__main__":
    main()
