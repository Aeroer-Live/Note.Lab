// Email templates for Note.Lab
export class EmailTemplates {
    static getPasswordResetEmail(userName, resetUrl) {
        return {
            subject: 'Reset Your Note.Lab Password',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - Note.Lab</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #238636;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #238636;
        }
        .content {
            padding: 30px 0;
        }
        .button {
            display: inline-block;
            background-color: #238636;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
        }
        .button:hover {
            background-color: #1f7a2e;
        }
        .footer {
            text-align: center;
            padding: 20px 0;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
        }
        .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">📝 Note.Lab</div>
        <p>Developer-focused note-taking platform</p>
    </div>
    
    <div class="content">
        <h2>Hello ${userName},</h2>
        
        <p>We received a request to reset your password for your Note.Lab account. If you didn't make this request, you can safely ignore this email.</p>
        
        <p>To reset your password, click the button below:</p>
        
        <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
        </div>
        
        <div class="warning">
            <strong>Security Notice:</strong> This link will expire in 1 hour for your security. If you need to reset your password after that, please request a new reset link.
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        
        <p>Best regards,<br>The Note.Lab Team</p>
    </div>
    
    <div class="footer">
        <p>This email was sent to you because someone requested a password reset for your Note.Lab account.</p>
        <p>&copy; 2025 Note.Lab. Built for developers, by <a href="https://aeroer.live">Aeroer.Live</a>.</p>
    </div>
</body>
</html>
            `,
            text: `
Reset Your Note.Lab Password

Hello ${userName},

We received a request to reset your password for your Note.Lab account. If you didn't make this request, you can safely ignore this email.

To reset your password, visit this link:
${resetUrl}

Security Notice: This link will expire in 1 hour for your security. If you need to reset your password after that, please request a new reset link.

If you have any questions, please contact our support team.

Best regards,
The Note.Lab Team

---
This email was sent to you because someone requested a password reset for your Note.Lab account.
© 2025 Note.Lab. Built for developers, by Aeroer.Live.
            `
        };
    }
    
    static getPasswordResetSuccessEmail(userName) {
        return {
            subject: 'Your Note.Lab Password Has Been Reset',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Successful - Note.Lab</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #238636;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #238636;
        }
        .content {
            padding: 30px 0;
        }
        .success {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #155724;
        }
        .footer {
            text-align: center;
            padding: 20px 0;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">📝 Note.Lab</div>
        <p>Developer-focused note-taking platform</p>
    </div>
    
    <div class="content">
        <h2>Hello ${userName},</h2>
        
        <div class="success">
            <strong>✅ Your password has been successfully reset!</strong>
        </div>
        
        <p>Your Note.Lab account password has been updated. You can now sign in with your new password.</p>
        
        <p>If you didn't reset your password, please contact our support team immediately as your account may have been compromised.</p>
        
        <p>Best regards,<br>The Note.Lab Team</p>
    </div>
    
    <div class="footer">
        <p>&copy; 2025 Note.Lab. Built for developers, by <a href="https://aeroer.live">Aeroer.Live</a>.</p>
    </div>
</body>
</html>
            `,
            text: `
Your Note.Lab Password Has Been Reset

Hello ${userName},

✅ Your password has been successfully reset!

Your Note.Lab account password has been updated. You can now sign in with your new password.

If you didn't reset your password, please contact our support team immediately as your account may have been compromised.

Best regards,
The Note.Lab Team

---
© 2025 Note.Lab. Built for developers, by Aeroer.Live.
            `
        };
    }
}
