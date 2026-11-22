# Translation design and evaluation boundaries

## This release is a video dictionary

`backend/translation.py` normalizes Arabic presentation forms, diacritics, tatweel, hamza-on-alif variants and punctuation. It then greedily matches the longest covered phrase. The output preserves the order of matched input phrases. It never inserts an unknown sign, guesses an image, generates a confidence score or represents manually typed text as camera recognition.

A response contains:

- `status`: `dictionary_match`, `partial` or `unsupported` for text input.
- `clips`: matched video records, with local URL, source, attribution and license.
- `segments`: every matched and unknown segment in input order.
- `unknown`: the uncovered words, also visible in the UI.
- `output_text`: the matched glosses, separated by ` | `. This is a dictionary gloss sequence, not a grammatical sign-language sentence.
- `confidence`: null. No recognition model has run.

The player only plays the matched clips. In a partial match it does not pretend that the missing words were translated. For example, `صباح الخير موز` displays one greeting clip and explicitly identifies `موز` as unsupported. Aliases such as `عامل ايه`, `كيف حالك`, `عايز` and `طبيب` map to specific dictionary entries. Synonym coverage is intentionally finite, not fuzzy guessing.

## Source and provenance

The bundled media comes from Mendeley Data V1, DOI 10.17632/39tbt2jd7r.1, by Ahmed Métwalli, Ahmed Metwalli and Ahmed Elshaer (2025):
https://data.mendeley.com/datasets/39tbt2jd7r/1

The source page's structured license metadata is CC BY 4.0. Attribution, changes and license link appear in THIRD_PARTY_NOTICES.md. Each manifest entry records its source archive path, original SHA-256, transformed SHA-256, source label and chosen Arabic gloss. All clips were resized to 480p, re-encoded for browser playback and stripped of audio. Original landmark overlays are retained.

The source description's counts differ from the actual archive, as the notices explain. We did not silently convert all transliterated labels: only 32 unambiguous label names are mapped in this release. No independent native-signer or expert validation has been completed. `review_status` explicitly records this. The app must not be described as an evaluated Egyptian Sign Language translator.

## Lessons

Six lessons group these dictionary entries. The seed process fills the existing `signs`, `sign_media`, `lessons`, `lesson_items` and `quizzes` tables idempotently. Quizzes show a video with four choices. Answer keys stay on the server until submission. The server checks that all questions have valid choices, computes the score, records it in `quiz_results` and keeps the best progress. A user cannot complete a video lesson merely by posting progress=1 without a matching quiz score. Existing text-only sample lessons remain clearly labeled. `saved_signs` is used by the dictionary and saved-signs screen.

## Camera recognition

No camera recognition model or training claim is included. A `RecognitionProvider` protocol states the expected inference boundary: video bytes, MIME type, model card, and either a structured result or abstention. Nothing invokes a remote inference service, and camera frames are not uploaded. The legacy text `sign_to_text` endpoint never returns output and labels the request `model_unavailable`; the UI no longer presents typed text as an inferred result.

To extend this responsibly:

1. Obtain appropriately licensed Egyptian Sign Language video data and signer consent that covers the intended use. Get Deaf-community review of labels and regional variants.
2. Split training and evaluation by signer, recording session and location, not random neighboring frames. Include unknown-sign, no-hand and out-of-distribution examples.
3. Train and document the model. Measure per-class performance, abstention/false-positive rates, latency and supported input conditions on independent signers.
4. Implement the provider with explicit abstention and size/MIME validation, connect an upload/inference route only after consent/privacy design, and expose its actual capabilities through the API.
5. Update the UI and `model_versions` only with real model-card and evaluation records. Do not activate a model solely because it returns labels.

A protocol is an integration boundary, not a shipped neural model. No accuracy number is claimed for this release.
