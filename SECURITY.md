# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public GitHub issue.

Instead, please report security issues responsibly by emailing the maintainers directly or using GitHub's private vulnerability reporting feature if available.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Initial response**: Within 48 hours
- **Status update**: Within 7 days
- **Fix timeline**: Depends on severity (critical issues prioritized)

## Security Best Practices for Deployment

### Required Before Production

1. **Change AUTH_SECRET** - Generate a secure random string:
   \`\`\`bash
   openssl rand -base64 32
   \`\`\`

2. **Change POSTGRES_PASSWORD** - Use a strong, unique password

3. **Remove demo credentials** - Delete DEMO_USER_* environment variables

4. **Enable HTTPS** - Use a reverse proxy (nginx, Traefik) or Cloudflare Tunnel

5. **Restrict database access** - Remove the 127.0.0.1:5432 port binding in production

### Security Features

- **Rate limiting**: 10 login attempts/minute per IP (brute-force protection)
- **Input validation**: All API endpoints validated with Zod schemas
- **Audit logging**: All significant actions logged with IP and user agent
- **Secure cookies**: httpOnly, sameSite=lax, secure (when HTTPS)
- **Password hashing**: bcrypt with cost factor 12
- **No user enumeration**: Login failures use generic error messages

### Headers

The application sets the following security headers:

- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()

## Dependencies

We regularly update dependencies to patch known vulnerabilities. Run \`pnpm audit\` to check for issues.

## Acknowledgments

Thanks to all security researchers who responsibly disclose vulnerabilities.
