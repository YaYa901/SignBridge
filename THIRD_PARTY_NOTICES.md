# Third-party notices

## Egyptian Sign Language videos

Métwalli, Ahmed; Metwalli, Ahmed; Elshaer, Ahmed (2025), "Egyptian Sign Language", Mendeley Data, V1.

- Source: https://data.mendeley.com/datasets/39tbt2jd7r/1
- DOI: https://doi.org/10.17632/39tbt2jd7r.1
- License: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/
- Scope: the 32 MP4 files in `backend/media/`, one selected source sample for each included label.
- Changes: resized to a 480-pixel height, H.264 re-encoding, audio removed, web playback metadata moved to the start. Existing pose landmarks and frame/time labels come from the source videos.
- Arabic display labels and search aliases were mapped from the original transliterated folder names. These mappings and the signs have not had independent expert or Deaf-community review.
- Original paths and SHA-256 checksums, delivered-file checksums, individual attribution and license are recorded in `backend/signs.json`.
- No endorsement by the contributors, publisher or signers is implied.

The publisher description states 55 classes and 550 videos. The downloaded V1 archive actually contained 477 MP4 files across 56 label folders. This delivery does not claim the publisher's sample count as a verified archive count. It deliberately uses only 32 labels with clear meanings and does not guess the others.

## Fonts

Cairo and Inter are bundled locally through their `@fontsource` packages, under the SIL Open Font License 1.1. Full license notices are in `docs/licenses/Cairo-OFL.txt` and `docs/licenses/Inter-OFL.txt`. No Google Fonts request is needed at runtime.

## Software

React, React Router, Vite, FastAPI, Pydantic, Uvicorn, Lucide, Tailwind CSS, Vitest, Playwright and other dependencies retain their package licenses. Versions are recorded in `frontend/package-lock.json` and `backend/requirements.lock`; package distributions contain the applicable license files.

Swagger UI assets in `backend/docs_assets/` are copied from the pinned `swagger-ui-dist` package so `/docs` also works without an external CDN. Its full license is in `docs/licenses/Swagger-UI-LICENSE.txt`.

Mailpit is a separate demo service, not bundled software in this source archive. Its official project is https://github.com/axllent/mailpit and its setup documentation is https://mailpit.axllent.org/docs/install/docker/ . The Compose demo uses `axllent/mailpit:v1.33.0` and does not relay mail to the internet.
