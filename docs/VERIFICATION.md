# Verification report

Date: 22 November 2026

## Executed successfully

Environment: Node.js 22.23.5, Python 3.10.12, Linux, Chromium through Playwright.

- A clean staged copy completed `npm run setup`, all 29 Python tests and `npm run build` successfully, using only the delivered project files plus downloaded dependencies.
- 29 Python tests passed. These cover the original account/data flows plus dictionary matching, partial/unknown results, all media URLs, durable rate limits, lockout across app restarts, cookie flags, CSRF guards, logout/expiry/revocation, single-use and expired email links, SMTP TLS/failure handling, quiz grading/progress, saved signs, admin feedback, paginated history, data export, deletion/foreign keys and concurrent migrations.
- 8 Vitest frontend tests passed: cookie API calls, unauthorized handling, paginated exports, feedback association, account forms and real-media player behavior.
- 2 full Chromium scenarios passed against the real FastAPI server. They covered registration, a playing dictionary video, partial coverage, sequence navigation, feedback, export download, deep links and refresh, a graded quiz, saved signs, desktop/mobile layout, privacy, logout, email verification, password reset, login with the replacement password, and the locally served OpenAPI UI.
- The email browser scenario ran with the actual Mailpit v1.33.0 binary as an SMTP server. Both emails appeared in its inbox and their links completed successfully. It also runs without Mailpit using private EML files for local-only development.
- TypeScript/Vite production build passed.
- ESLint passed with zero warnings.
- npm audit reported zero vulnerabilities at verification time. This is not a permanent security guarantee.
- Bundled video provenance and delivered-file hashes are recorded in `backend/signs.json`.

## Visual inspection

The desktop translation screen, 390-pixel mobile screen, actual video frames and the Mailpit inbox were inspected. The videos show real signer motion with source landmark overlays, not generated animation. The mobile navigation closes off-canvas and the content fits the viewport. Reference screenshots are in `docs/screenshots/`.

## Not claimed or not executed

- Docker is not available in the verification environment, so the Dockerfile and Compose configurations were supplied but not built or run there. The same application, static build and actual SMTP service were exercised directly. CI includes a Docker build job for the target environment.
- No public deployment, external email delivery or production SMTP credentials were used.
- No independent Egyptian Sign Language expert review, neural recognition model training or model accuracy evaluation was performed. Dictionary labels are inherited from the research dataset and mapped from its transliterations. Camera recognition remains explicitly unavailable.
- Windows/macOS setup was not executed. The Node helper supports their path conventions, and the Python lock excludes uvloop on Windows.
- The privacy page is an accurate description of this demo's behavior, not a substitute for an operator's legal/compliance review and published contact/retention policy.

## License choice

The project code includes a rights notice rather than silently selecting an open-source license for the owner. Bundled videos and fonts retain their own stated licenses and attribution.
