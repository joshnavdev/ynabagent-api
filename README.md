# ynabagent-api

An AWS SAM application that extracts YNAB transactions from a screenshot. A single Lambda runs an Express app behind API Gateway: the client requests a presigned S3 upload URL, uploads a bank/app screenshot directly to S3, then asks the API to extract every transaction as JSON using `gpt-4o-mini` vision. Amounts are Peruvian soles (PEN). Categories are constrained to an allowed list, and every boundary is validated with Zod.

## How it works

1. **`POST /uploads`** — send `{ "contentType": "image/png" }`. The server generates the S3 key and returns `{ "key", "uploadUrl" }`.
2. **`PUT` to S3** — upload the screenshot bytes directly to `uploadUrl`.
3. **`POST /generate`** — send `{ "key" }`. The server verifies the upload, loads `ynab_memory.md` from S3 (categories + payee history), hands a presigned GET URL to `gpt-4o-mini`, re-validates the result, and returns `{ "transactions": [...] }`.

## Quickstart

```bash
npm install
cp .env.example .env        # set OPENAI_API_KEY (and optionally USD_PEN_RATE)
npm run build               # sam build
npm run sam:local           # serves the API locally
```

## Upload the knowledge base to S3

`ynab_memory.md` (the allowed categories + your payee history) is the source of truth. After `sam deploy`, upload it to the bucket at the configured key:

```bash
aws s3 cp ynab_memory.md "s3://<UploadBucketName>/config/ynab_memory.md"
```

The Lambda fetches and caches it (5-minute TTL), so you can update the file in S3 without redeploying.

## Example requests

Request a presigned upload URL:

```bash
curl -X POST http://localhost:3000/uploads \
  -H 'Content-Type: application/json' \
  -d '{"contentType":"image/png"}'
# -> { "key": "uploads/<uuid>.png", "uploadUrl": "https://..." }
```

Upload the screenshot directly to S3:

```bash
curl -X PUT "<uploadUrl>" \
  -H 'Content-Type: image/png' \
  --data-binary @screenshot.png
```

Extract transactions:

```bash
curl -X POST http://localhost:3000/generate \
  -H 'Content-Type: application/json' \
  -d '{"key":"uploads/<uuid>.png"}'
```

Response:

```json
{
  "transactions": [
    {
      "date": "2024-05-12",
      "payee": "Rappi",
      "amount": 84.50,
      "direction": "outflow",
      "category": "Immediate Obligations > Almuerzos Y Cenas",
      "confidence": "high",
      "note": ""
    }
  ]
}
```

## Domain rules

- Amounts are PEN and already in budget currency.
- USD transactions: the model converts the amount to PEN using `USD_PEN_RATE` and records the original USD value in `note`.
- `category` is always a full `Parent > Child` path from the allowed list (re-validated server-side).
- `confidence` is `high` only on an exact payee-history match, otherwise `low`.

The knowledge base (`ynab_memory.md`) is injected into the prompt as raw text. Add new constraints by editing [src/constraints.ts](src/constraints.ts): push a string to `PROMPT_RULES` — the model applies it.

## Token usage logging

Each `/generate` call logs two structured JSON lines (visible in CloudWatch, or stdout under `sam local`):

- `token_estimate` — local counts via `js-tiktoken`: `memoryTokens` (what `ynab_memory.md` costs) and `systemPromptTokens` (full text prompt).
- `token_usage` — actual API usage: `promptTokensWithImage` (input incl. the screenshot), `completionTokens`, `totalTokens`.

## Custom domain & deployment

The API is served at `https://api.ynabagent.josnavdev.lat`. SAM manages the ACM certificate, the API Gateway custom domain, the base-path mapping, and the Route53 alias record. Deploy-time config is read from SSM Parameter Store.

### One-time manual prerequisites

1. Create a Route53 **public hosted zone** for `josnavdev.lat` and point your registrar's nameservers at the zone's 4 `NS` records.
2. Create SSM parameters in `us-east-1`:
   - `/ynab/openai-api-key` — type **String** — your OpenAI key (referenced via `{{resolve:ssm:/ynab/openai-api-key:1}}`).
   - `/ynab/hosted-zone-id` — type **String** — the hosted zone ID.
   - `/ynab/oauth-client-id` — type **String** — your YNAB OAuth app client id.
   - `/ynab/oauth-client-secret` — type **String** — your YNAB OAuth app client secret.
3. Create a YNAB OAuth application at `app.ynab.com/settings/oauth/applications`; set its redirect URI to your client page (the `YnabRedirectUri` stack parameter). Copy the client id/secret into the SSM params above.
4. Create your single Cognito user (after first deploy, via the console or `aws cognito-idp admin-create-user`) and set a password.
5. Create a GitHub **OIDC identity provider** (`token.actions.githubusercontent.com`) and an **IAM deploy role** with a trust policy scoped to `repo:<org>/<repo>:ref:refs/heads/main`. Grant it CloudFormation, Lambda, API Gateway, S3, ACM, Route53, Cognito, DynamoDB, IAM (for the function role), and `ssm:GetParameter*` on `/ynab/*`. Store the role ARN as the repo variable `AWS_DEPLOY_ROLE_ARN` and the region as `AWS_REGION`.

## Authentication

Two distinct tokens, two jobs:

- **Cognito JWT** — the client logs in to the Cognito User Pool (custom form via `InitiateAuth` with `USER_PASSWORD_AUTH`) and sends the resulting JWT in the `Authorization: Bearer <jwt>` header on every request. API Gateway's JWT authorizer validates it; the JWT's `sub` claim is the `userId`. All routes except `GET /health` require it.
- **YNAB OAuth token** — never sent by the client. The client does the YNAB consent flow, receives a `?code=`, and posts it to `POST /auth/ynab/callback`. The server exchanges it for YNAB access/refresh tokens and stores them in DynamoDB keyed by `userId`. Subsequent YNAB calls read those tokens (refreshing the 2-hour access token automatically).

### YNAB endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/auth/ynab/callback` | Body `{ code }`. Exchanges the OAuth code, stores tokens. |
| `GET` | `/ynab/budgets` | Lists your YNAB budgets. |
| `GET` | `/ynab/budgets/:budgetId/accounts` | Lists accounts in a budget. |
| `POST` | `/transactions/push` | Body `{ budgetId, accountId, transactions }`. Pushes extracted transactions into YNAB (amounts converted to milliunits, sign by direction, category resolved by `Parent > Child` name). |

### Continuous deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which authenticates to AWS via OIDC (no stored keys), runs `sam build`, and `sam deploy`. The deploy reads `HostedZoneId` and the OpenAI key from SSM. Stack name, region, and capabilities come from [samconfig.toml](samconfig.toml).

### First deploy / local bootstrap

```bash
sam build
sam deploy
```

The first deploy pauses for a few minutes while ACM validates the certificate via DNS (the validation record is created automatically). Afterward, `curl https://api.ynabagent.josnavdev.lat/health` returns `{ "status": "ok" }`.

## Parameters and environment variables

The stack reads these (SSM-resolved, not committed):

| Name | Source | Notes |
|------|--------|-------|
| `DomainName` | template default | `api.ynabagent.josnavdev.lat` |
| `YnabRedirectUri` | stack parameter | client page that receives the YNAB OAuth `?code=` |
| `HostedZoneId` | SSM `/ynab/hosted-zone-id` | Route53 zone for `josnavdev.lat` |
| `OPENAI_API_KEY` | SSM `/ynab/openai-api-key` (String) | injected into the Lambda env via `{{resolve:ssm:...:1}}` |
| `YNAB_CLIENT_ID` | SSM `/ynab/oauth-client-id` (String) | YNAB OAuth app client id |
| `YNAB_CLIENT_SECRET` | SSM `/ynab/oauth-client-secret` (String) | YNAB OAuth app client secret (server-side only) |

Lambda environment variables:

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `OPENAI_API_KEY` | Yes | — | from SSM String |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Vision-capable model |
| `UPLOAD_BUCKET` | Yes | — | S3 bucket name, injected by SAM at deploy |
| `USD_PEN_RATE` | No | `3.75` | Exchange rate for USD->PEN conversion |
| `YNAB_MEMORY_KEY` | No | `config/ynab_memory.md` | S3 key of the knowledge base file |
| `YNAB_TOKENS_TABLE` | Yes | — | DynamoDB table for per-user YNAB tokens, injected by SAM |
| `YNAB_CLIENT_ID` | Yes | — | from SSM String |
| `YNAB_CLIENT_SECRET` | Yes | — | from SSM String |
| `YNAB_REDIRECT_URI` | Yes | — | YNAB OAuth redirect URI |

Stack outputs include `CustomDomainUrl`, `UploadBucketName`, `UserPoolId`, and `UserPoolClientId`.

## Conventions

See [AGENTS.md](AGENTS.md) and the project skill at `.cursor/skills/sam-express-vision/SKILL.md` for architecture and contribution conventions.
