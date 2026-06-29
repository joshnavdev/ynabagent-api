# SAM Express Vision API

An AWS SAM application that turns uploaded images into structured JSON. A single Lambda runs an Express app behind API Gateway: clients request a presigned S3 upload URL, upload an image directly to S3, then ask the API to extract structured JSON from that image using `gpt-4o-mini` vision. Every request and response boundary is validated with Zod.

> Status: documentation-first. This README describes the target project; the code scaffold is added in a follow-up step.

## How it works

1. **`POST /uploads`** — send `{ "contentType": "image/png" }`. The server generates the S3 key and returns `{ "key", "uploadUrl" }`.
2. **`PUT` to S3** — upload the image bytes directly to `uploadUrl`.
3. **`POST /generate`** — send `{ "key" }`. The server verifies the upload, hands a presigned GET URL to `gpt-4o-mini`, and returns the validated JSON.

## Quickstart (target)

```bash
npm install
cp .env.example .env        # set OPENAI_API_KEY
sam build
sam local start-api         # serves the API locally
```

## Example requests

Request a presigned upload URL:

```bash
curl -X POST http://localhost:3000/uploads \
  -H 'Content-Type: application/json' \
  -d '{"contentType":"image/png"}'
# -> { "key": "uploads/<uuid>.png", "uploadUrl": "https://..." }
```

Upload the image directly to S3:

```bash
curl -X PUT "<uploadUrl>" \
  -H 'Content-Type: image/png' \
  --data-binary @image.png
```

Generate structured JSON from the uploaded image:

```bash
curl -X POST http://localhost:3000/generate \
  -H 'Content-Type: application/json' \
  -d '{"key":"uploads/<uuid>.png"}'
# -> { "data": { ... } }
```

## Deploy

```bash
sam deploy --guided
```

## Environment variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Vision-capable model |
| `UPLOAD_BUCKET` | Yes | — | S3 bucket name, injected by SAM at deploy |

## Conventions

See [AGENTS.md](AGENTS.md) and the project skill at `.cursor/skills/sam-express-vision/SKILL.md` for architecture and contribution conventions.
