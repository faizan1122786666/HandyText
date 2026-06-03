import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ..config import settings


def generate_otp(length=6):
    """Generate a random 6-digit OTP code."""
    return ''.join(random.choices(string.digits, k=length))


async def send_otp_email(email: str, otp: str):
    """
    Send OTP email to the user using SMTP.
    Requires SMTP_HOST, SMTP_PORT, SMTP_EMAIL, and SMTP_PASSWORD in .env
    Falls back to console logging if SMTP is not configured.
    """
    # Check if SMTP settings are configured
    smtp_host = getattr(settings, 'SMTP_HOST', None)
    smtp_port = getattr(settings, 'SMTP_PORT', 587)
    smtp_email = getattr(settings, 'SMTP_EMAIL', None)
    smtp_password = getattr(settings, 'SMTP_PASSWORD', None)

    if not smtp_host or not smtp_email or not smtp_password:
        # Fallback: log to console when SMTP is not configured
        print(f"\n" + "=" * 50)
        print(f"📧 SENDING EMAIL TO: {email}")
        print(f"🔑 YOUR HANDYTEXT OTP CODE IS: {otp}")
        print(f"🕒 Valid for 1 minute.")
        print(f"⚠️  SMTP not configured — email printed to console only.")
        print(f"   Set SMTP_HOST, SMTP_EMAIL, SMTP_PASSWORD in .env to enable real emails.")
        print("=" * 50 + "\n")
        return True

    # Build the email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "HandyText - Password Reset OTP"
    msg["From"] = smtp_email
    msg["To"] = email

    # Plain text version
    text_body = (
        f"Your HandyText OTP code is: {otp}\n\n"
        f"This code is valid for 1 minute.\n"
        f"If you did not request this, please ignore this email."
    )

    # HTML version
    html_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #4F46E5; margin-bottom: 24px;">HandyText</h2>
        <p style="color: #374151; font-size: 16px;">Your password reset code is:</p>
        <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1F2937;">{otp}</span>
        </div>
        <p style="color: #6B7280; font-size: 14px;">This code expires in <strong>1 minute</strong>.</p>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 32px;">
            If you didn't request this code, you can safely ignore this email.
        </p>
    </div>
    """

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, email, msg.as_string())
        print(f"✅ OTP email sent to {email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send OTP email to {email}: {e}")
        # Still log to console as fallback
        print(f"🔑 FALLBACK — OTP CODE: {otp}")
        return False
