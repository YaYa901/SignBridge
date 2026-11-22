# Vercel demo deployment

Live demo: https://signbridge-demo-three.vercel.app/

This copy adds persistent Turso storage to the disposable Vercel demo. Local runs still use SQLite when TURSO_DATABASE_URL is unset. Production outside DEMO_MODE keeps the original production configuration checks.

## Server environment

Keep these values on the server, never in frontend environment variables:

- ENV=production and DEMO_MODE=1
- TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
- APP_URL=https://signbridge-demo-three.vercel.app
- TRUST_PROXY=1
- SMTP_HOST, SMTP_PORT, SMTP_STARTTLS, SMTP_USER, SMTP_PASSWORD, MAIL_FROM
- SMTP_TEST_MAILBOX=1 for Ethereal test mail

Secrets are intentionally absent from this archive. The deployed project has the Turso values in Production and Preview.

The root app.py, vercel.json, requirements.txt and .python-version are Vercel entry/build configuration. The Turso adapter uses the HTTPS Hrana v2 pipeline with a stateful stream and explicit transactions. Sessions take an immediate write lock, prioritizing correctness over high concurrency in this small demo. The free service's quota limits still apply. This is not a production capacity assessment.

Email is captured in the project's Ethereal test mailbox. It is never delivered to the real recipient. Anyone using the demo should use dummy information and a unique test password. The UI labels these limits.

## Verified on November 22, 2026

- Fresh browser registration, test email receipt, confirmation, logout and login.
- Verified status and authenticated session across page requests.
- Accounts and history persisted across a redeploy.
- 32 dictionary entries, with the morning greeting video playing to completion.
- 29 backend tests: python -m unittest discover -s backend/tests
- Turso transaction rollback, read-your-writes and foreign-key enforcement checked.

Dictionary video labels come from the cited research dataset and have not been reviewed by an independent sign-language expert. Full sentence translation and camera recognition are not implemented.
