"""Email transport abstraction.

Three implementations:
  * ConsoleTransport — logs to stdout, returns success. Default for local dev.
  * SmtpTransport    — stdlib smtplib with STARTTLS.
  * SendGridTransport — SendGrid HTTPS API.

Choose via `EMAIL_TRANSPORT` env var.
"""

from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class OutboundEmail:
    to: str
    subject: str
    body: str
    language: str


class EmailTransport(Protocol):
    def send(self, email: OutboundEmail) -> None: ...


class ConsoleTransport:
    def send(self, email: OutboundEmail) -> None:
        logger.info(
            "[ConsoleTransport] to=%s lang=%s subject=%s\n%s",
            email.to,
            email.language,
            email.subject,
            email.body,
        )


class SmtpTransport:
    def __init__(self, settings: Settings) -> None:
        if not (settings.smtp_host and settings.smtp_user and settings.smtp_password):
            raise RuntimeError("SMTP_HOST / SMTP_USER / SMTP_PASSWORD must be set")
        self._settings = settings

    def send(self, email: OutboundEmail) -> None:
        s = self._settings
        msg = EmailMessage()
        msg["From"] = f"{s.email_from_name} <{s.email_from}>"
        msg["To"] = email.to
        msg["Subject"] = email.subject
        msg["Content-Language"] = email.language
        msg.set_content(email.body)

        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as conn:
            conn.starttls()
            conn.login(s.smtp_user, s.smtp_password)
            conn.send_message(msg)


class SendGridTransport:
    def __init__(self, settings: Settings) -> None:
        if not settings.sendgrid_api_key:
            raise RuntimeError("SENDGRID_API_KEY must be set")
        # Imported lazily so dev installs without sendgrid still work.
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        self._client = SendGridAPIClient(settings.sendgrid_api_key)
        self._Mail = Mail
        self._from = (settings.email_from, settings.email_from_name)

    def send(self, email: OutboundEmail) -> None:
        msg = self._Mail(
            from_email=self._from,
            to_emails=email.to,
            subject=email.subject,
            plain_text_content=email.body,
        )
        resp = self._client.send(msg)
        if resp.status_code >= 400:
            raise RuntimeError(f"SendGrid responded {resp.status_code}: {resp.body!r}")


def get_transport(settings: Settings | None = None) -> EmailTransport:
    settings = settings or get_settings()
    match settings.email_transport:
        case "smtp":
            return SmtpTransport(settings)
        case "sendgrid":
            return SendGridTransport(settings)
        case _:
            return ConsoleTransport()
