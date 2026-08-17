"""
Email service using Resend.
Handles all transactional emails: invites, password resets, notifications.
"""

from __future__ import annotations

from typing import Any

import resend
from app.core.config import settings


def _client() -> None:
    resend.api_key = settings.RESEND_API_KEY


def send_invite_email(
    to_email: str,
    first_name: str,
    invite_link: str,
    invited_by_name: str,
) -> None:
    """Send staff invite email with accept link."""
    _client()
    resend.Emails.send(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": "You've been invited to Faraja Solution Loans",
            "html": f"""
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <img src="https://farajasolutions.co.ke/logo.png" alt="Faraja Solution Loans" style="height: 40px; margin-bottom: 24px;" />
          <h2 style="color: #0D44A2; margin: 0 0 8px;">Welcome, {first_name}!</h2>
          <p style="color: #444; line-height: 1.6;">
            <strong>{invited_by_name}</strong> has invited you to join <strong>Faraja Solution Loans</strong>
            as a staff member.
          </p>
          <p style="color: #444; line-height: 1.6;">
            Click the button below to accept your invitation and set up your account.
            This link expires in <strong>72 hours</strong>.
          </p>
          <a href="{invite_link}"
             style="display: inline-block; margin: 24px 0; padding: 14px 28px;
                    background: #0D44A2; color: #fff; border-radius: 10px;
                    text-decoration: none; font-weight: 600; font-size: 15px;">
            Accept Invitation
          </a>
          <p style="color: #888; font-size: 13px;">
            If you weren't expecting this, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px;">Faraja Solution Loans · Miritini, Mombasa</p>
        </div>
        """,
        }
    )


def send_account_approved_email(to_email: str, first_name: str) -> None:
    """Notify staff member their account has been approved."""
    _client()
    login_link = f"{settings.FRONTEND_URL}/login"
    resend.Emails.send(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": "Your Faraja Solution Loans account is approved",
            "html": f"""
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="color: #0D44A2;">Account Approved, {first_name}!</h2>
          <p style="color: #444; line-height: 1.6;">
            Your Faraja Solution Loans account has been reviewed and approved.
            You can now log in and start working.
          </p>
          <a href="{login_link}"
             style="display: inline-block; margin: 24px 0; padding: 14px 28px;
                    background: #0D44A2; color: #fff; border-radius: 10px;
                    text-decoration: none; font-weight: 600; font-size: 15px;">
            Log In Now
          </a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px;">Faraja Solution Loans · Miritini, Mombasa</p>
        </div>
        """,
        }
    )


def send_password_reset_email(to_email: str, first_name: str, reset_link: str) -> None:
    """Send password reset link to staff member."""
    _client()
    resend.Emails.send(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": "Reset your Faraja Solution Loans password",
            "html": f"""
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="color: #0D44A2;">Password Reset</h2>
          <p style="color: #444; line-height: 1.6;">Hi {first_name},</p>
          <p style="color: #444; line-height: 1.6;">
            A Director has requested a password reset for your account.
            Click below to set a new password. This link expires in <strong>24 hours</strong>.
          </p>
          <a href="{reset_link}"
             style="display: inline-block; margin: 24px 0; padding: 14px 28px;
                    background: #F57424; color: #fff; border-radius: 10px;
                    text-decoration: none; font-weight: 600; font-size: 15px;">
            Reset Password
          </a>
          <p style="color: #888; font-size: 13px;">If you didn't request this, contact your Director immediately.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px;">Faraja Solution Loans · Miritini, Mombasa</p>
        </div>
        """,
        }
    )


def _digest_section_html(title: str, rows: list[dict[str, Any]]) -> str:
    """Render one digest section (due today / tomorrow / almost due / arrears)."""
    head = (
        "<tr>"
        "<th style='text-align:left; padding:8px 10px; font-size:12px; "
        "color:#0D44A2; border-bottom:1px solid #eee;'>Client</th>"
        "<th style='text-align:left; padding:8px 10px; font-size:12px; "
        "color:#0D44A2; border-bottom:1px solid #eee;'>Loan</th>"
        "<th style='text-align:right; padding:8px 10px; font-size:12px; "
        "color:#0D44A2; border-bottom:1px solid #eee;'>Outstanding</th>"
        "<th style='text-align:right; padding:8px 10px; font-size:12px; "
        "color:#0D44A2; border-bottom:1px solid #eee;'>Penalty</th>"
        "<th style='text-align:right; padding:8px 10px; font-size:12px; "
        "color:#0D44A2; border-bottom:1px solid #eee;'>Days Overdue</th>"
        "</tr>"
    )
    body = ""
    for r in rows:
        body += (
            "<tr>"
            f"<td style='padding:6px 10px; font-size:12px; color:#444;'>{r['client_name']}</td>"
            f"<td style='padding:6px 10px; font-size:12px; color:#444;'>{r['loan_number']}</td>"
            f"<td style='padding:6px 10px; font-size:12px; color:#444; text-align:right;'>"
            f"KES {r['outstanding']:,.0f}</td>"
            f"<td style='padding:6px 10px; font-size:12px; color:#F57424; text-align:right;'>"
            f"{f'KES {r.get("penalty", 0):,.0f}' if r.get('penalty') else '—'}</td>"
            f"<td style='padding:6px 10px; font-size:12px; color:#444; text-align:right;'>"
            f"{r.get('days_overdue', '—')}</td>"
            "</tr>"
        )
    return (
        f"<h3 style='color:#0D44A2; font-size:14px; margin:20px 0 6px;'>{title}</h3>"
        f"<table style='border-collapse:collapse; width:100%;'>{head}{body}</table>"
    )


def send_daily_digest_email(
    to_email: str, first_name: str, sections: list[tuple[str, list[dict[str, Any]]]]
) -> None:
    """Send the daily due/arrears digest; sections = (kind, rows) scoped + pref-filtered."""
    _client()
    kind_titles = {
        "almost_due": "Due in 2 days (T-2)",
        "due_tomorrow": "Due tomorrow",
        "due_today": "Due today",
        "arrears": "In arrears / past maturity",
    }
    body = "".join(
        _digest_section_html(kind_titles.get(kind, kind), rows) for kind, rows in sections
    )
    resend.Emails.send(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": "Daily loan digest — Faraja Solution Loans",
            "html": f"""
        <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="color: #0D44A2; margin: 0 0 8px;">Good morning, {first_name}</h2>
          <p style="color: #444; line-height: 1.6;">
            Here is today's loan summary for your branch(es). Tap into the app for full details.
          </p>
          {body}
          <p style="color: #888; font-size: 12px; margin-top: 24px;">
            Generated automatically each morning. You can adjust these alerts under
            Settings → Notifications.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="color: #aaa; font-size: 12px;">Faraja Solution Loans · Miritini, Mombasa</p>
        </div>
        """,
        }
    )


def send_loan_approved_email(to_email: str, loan_number: str, client_name: str) -> None:
    """Notify the submitting Loan Officer that their application was approved."""
    _client()
    resend.Emails.send(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": f"Loan {loan_number} approved",
            "html": f"""
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="color: #0D44A2;">Loan Approved</h2>
          <p style="color: #444; line-height: 1.6;">
            Loan <strong>{loan_number}</strong> for <strong>{client_name}</strong>
            has been approved. It is now awaiting disbursement.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="color: #aaa; font-size: 12px;">Faraja Solution Loans · Miritini, Mombasa</p>
        </div>
        """,
        }
    )


def send_loan_disbursed_email(to_email: str, loan_number: str, client_name: str) -> None:
    """Notify the submitting Loan Officer that their application was disbursed."""
    _client()
    resend.Emails.send(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": f"Loan {loan_number} disbursed",
            "html": f"""
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="color: #0D44A2;">Loan Disbursed</h2>
          <p style="color: #444; line-height: 1.6;">
            Loan <strong>{loan_number}</strong> for <strong>{client_name}</strong> has been
            disbursed. The repayment schedule is now active.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="color: #aaa; font-size: 12px;">Faraja Solution Loans · Miritini, Mombasa</p>
        </div>
        """,
        }
    )
