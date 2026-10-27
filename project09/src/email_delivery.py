"""Explicit local Gmail delivery; credentials never reach the browser."""
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from dotenv import dotenv_values


def send_plan_email(recipient, content):
    if not isinstance(recipient, str) or len(recipient) > 254 or not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+", recipient):
        raise ValueError('Địa chỉ email nhận không hợp lệ.')
    root = Path(__file__).resolve().parents[2]
    config = {**os.environ, **dotenv_values(root / '.env', interpolate=False), **dotenv_values(root / 'project09/.env', interpolate=False)}
    if config.get('EMAIL_TRANSPORT_DISABLED', '').lower() == 'true':
        raise ValueError('Môi trường triển khai này chưa bật gửi Gmail qua SMTP. Bạn vẫn tải PDF được; cần máy chủ cho phép SMTP để gửi email.')
    sender = (config.get('GMAIL_SENDER') or '').strip()
    password = (config.get('GMAIL_APP_PASSWORD') or '').replace(' ', '')
    if not sender or not password:
        raise ValueError('Chưa cấu hình GMAIL_SENDER và GMAIL_APP_PASSWORD trong .env phía server.')
    msg = EmailMessage()
    msg['From'] = sender
    msg['To'] = recipient
    msg['Subject'] = 'HTD – Báo cáo kế hoạch tài chính của bạn'
    msg.set_content('HTD gửi bạn báo cáo kế hoạch tài chính trong tệp PDF đính kèm. Kết quả là mô phỏng theo giả định đã xác nhận, không cam kết lợi nhuận.')
    msg.add_attachment(content, maintype='application', subtype='pdf', filename='HTD_Project09_Plan.pdf')
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=25, context=ssl.create_default_context()) as smtp:
            smtp.login(sender, password)
            smtp.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        raise ValueError('Gmail từ chối đăng nhập. Kiểm tra mật khẩu ứng dụng và xác minh hai bước.') from None
    except (smtplib.SMTPException, OSError):
        raise ValueError('Chưa xác nhận gửi thành công. Kiểm tra mạng và hộp thư trước khi thử lại.') from None
