import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
from dotenv import load_dotenv
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Load environment variables
load_dotenv()

# Email configuration
GMAIL_EMAIL = os.getenv("GMAIL_EMAIL")
GMAIL_PASSWORD = os.getenv("GMAIL_PASSWORD")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

# Thread pool for async email sending
executor = ThreadPoolExecutor(max_workers=2)


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send an email using Gmail SMTP.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML content of the email
        
    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        if not GMAIL_EMAIL or not GMAIL_PASSWORD:
            print("Error: Gmail credentials not configured in .env file")
            return False
        
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = GMAIL_EMAIL
        msg["To"] = to_email
        
        # Attach HTML content
        part = MIMEText(html_content, "html")
        msg.attach(part)
        
        # Connect to Gmail and send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(GMAIL_EMAIL, GMAIL_PASSWORD)
            server.send_message(msg)
        
        print(f"Email sent successfully to {to_email}")
        return True
        
    except smtplib.SMTPAuthenticationError:
        print("Error: Gmail authentication failed. Check your credentials.")
        return False
    except smtplib.SMTPException as e:
        print(f"Error: SMTP error occurred: {str(e)}")
        return False
    except Exception as e:
        print(f"Error: Failed to send email: {str(e)}")
        return False


async def send_email_async(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send an email asynchronously to avoid blocking the API response.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML content of the email
        
    Returns:
        True if email sent successfully, False otherwise
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, send_email, to_email, subject, html_content)


def generate_ticket_update_email(reporter_name: str, ticket_id: str, ticket_title: str, 
                                 new_status: str, admin_name: str = None, 
                                 response_text: str = None) -> str:
    """
    Generate HTML email content for ticket update notifications.
    
    Args:
        reporter_name: Name of the ticket reporter
        ticket_id: ID of the ticket
        ticket_title: Title of the ticket
        new_status: New status of the ticket
        admin_name: Name of the admin who updated the ticket
        response_text: Admin's response text (if applicable)
        
    Returns:
        HTML string for the email content
    """
    status_colors = {
        "open": "#3B82F6",
        "in_progress": "#F59E0B",
        "resolved": "#10B981",
        "closed": "#6B7280"
    }
    
    status_color = status_colors.get(new_status, "#3B82F6")
    
    html_content = f"""
    <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9fafb;
                }}
                .header {{
                    background-color: #1e3a8a;
                    color: white;
                    padding: 20px;
                    border-radius: 8px 8px 0 0;
                    text-align: center;
                }}
                .content {{
                    background-color: white;
                    padding: 20px;
                    border: 1px solid #e5e7eb;
                }}
                .status-badge {{
                    display: inline-block;
                    background-color: {status_color};
                    color: white;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-weight: bold;
                    margin-top: 10px;
                }}
                .ticket-info {{
                    background-color: #f3f4f6;
                    padding: 15px;
                    border-left: 4px solid {status_color};
                    margin: 15px 0;
                    border-radius: 4px;
                }}
                .info-item {{
                    margin: 10px 0;
                }}
                .label {{
                    font-weight: bold;
                    color: #1e3a8a;
                }}
                .response-section {{
                    background-color: #f0f9ff;
                    padding: 15px;
                    border-left: 4px solid #0284c7;
                    margin: 15px 0;
                    border-radius: 4px;
                }}
                .footer {{
                    background-color: #f3f4f6;
                    padding: 15px;
                    text-align: center;
                    font-size: 12px;
                    color: #6b7280;
                    border-top: 1px solid #e5e7eb;
                }}
                .button {{
                    display: inline-block;
                    background-color: #1e3a8a;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 4px;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Pacific Support System</h1>
                    <p>Ticket Update Notification</p>
                </div>
                
                <div class="content">
                    <p>Hi <strong>{reporter_name}</strong>,</p>
                    
                    <p>Your support ticket has been updated. Here are the details:</p>
                    
                    <div class="ticket-info">
                        <div class="info-item">
                            <span class="label">Ticket ID:</span> {ticket_id}
                        </div>
                        <div class="info-item">
                            <span class="label">Title:</span> {ticket_title}
                        </div>
                        <div class="info-item">
                            <span class="label">New Status:</span>
                            <span class="status-badge">{new_status.upper().replace('_', ' ')}</span>
                        </div>
                    </div>
    """
    
    if admin_name and response_text:
        html_content += f"""
                    <div class="response-section">
                        <p><strong>Response from {admin_name}:</strong></p>
                        <p>{response_text}</p>
                    </div>
        """
    
    html_content += f"""
                    <p>We appreciate your patience. If you have any questions, please reply to this email.</p>
                    
                    <a href="http://localhost:5173" class="button">View Your Ticket</a>
                    
                </div>
                
                <div class="footer">
                    <p>&copy; 2024 Pacific Support System. All rights reserved.</p>
                    <p>This is an automated notification email. Please do not reply to this address.</p>
                </div>
            </div>
        </body>
    </html>
    """
    
    return html_content
