"""
Email service using Resend.
Handles all transactional emails: invites, password resets, notifications.
"""
from __future__ import annotations

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
    resend.Emails.send({
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
    })


def send_account_approved_email(to_email: str, first_name: str) -> None:
    """Notify staff member their account has been approved."""
    _client()
    login_link = f"{settings.FRONTEND_URL}/login"
    resend.Emails.send({
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
    })


def send_password_reset_email(to_email: str, first_name: str, reset_link: str) -> None:
    """Send password reset link to staff member."""
    _client()
    resend.Emails.send({
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
    })
