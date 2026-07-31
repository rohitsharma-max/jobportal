# API Contract

> The agreement between frontend and backend. We build and test **all** of this in Postman
> BEFORE writing any React. If the API is solid, the frontend is "just" a display layer.

**Base URL (local dev):** `http://localhost:5000/api`

## Consistent response shape
Every endpoint returns the same envelope, so the frontend always knows what to expect:

```json
{ "success": true,  "data": { }, "message": "..." }
{ "success": false, "data": null, "message": "What went wrong" }
```

Failures may carry two extra keys:

```json
{
  "success": false,
  "data": null,
  "message": "Name is required",
  "errors": { "name": "Name is required", "email": "Enter a valid email address" },
  "code": "TOKEN_EXPIRED"
}
```

- **`errors`** — one entry per offending field, present whenever validation fails.
  `message` repeats the first of them so a client that only reads `message` still
  shows something useful. Forms use `errors` to highlight individual inputs.
- **`code`** — a stable machine-readable reason on auth and conflict failures
  (see the table below). Never parse `message`; switch on `code`.

## HTTP status codes we use
| Code | When |
|---|---|
| `200` | Successful GET / PUT / PATCH / DELETE |
| `201` | Successful POST (resource created) |
| `400` | Validation failed — missing/invalid field, bad ObjectId, malformed JSON |
| `401` | Not authenticated — no token, invalid token, or expired token |
| `403` | Authenticated but not allowed (non-admin hitting an admin route) |
| `404` | Resource not found (well-formed id not in DB, or unknown route) |
| `409` | Conflict — email already registered, or already applied to this opportunity |
| `413` | Request body larger than 100 kB |
| `429` | Rate limited (too many login/register attempts) |
| `503` | Resume upload requested but Cloudinary is not configured |
| `500` | Unexpected server error (should be rare) |

## Error codes
| `code` | Status | Meaning | What the client should do |
|---|---|---|---|
| `NO_TOKEN` | 401 | No `Authorization` header | Send to login |
| `TOKEN_EXPIRED` | 401 | Access token past its 1-minute life | **Refresh, then retry the request** |
| `TOKEN_INVALID` | 401 | Malformed token, or a refresh token used as an access token | Clear session, send to login |
| `USER_GONE` | 401 | Token valid but the account was deleted | Clear session, send to login |
| `BAD_CREDENTIALS` | 401 | Wrong email or password | Show the message on the login form |
| `REFRESH_EXPIRED` | 401 | Refresh token past its 7-day life | Clear session, send to login |
| `REFRESH_INVALID` | 401 | Refresh token malformed or wrong type | Clear session, send to login |
| `REFRESH_REVOKED` | 401 | Logged out elsewhere (`tokenVersion` bumped) | Clear session, send to login |
| `FORBIDDEN` | 403 | Not an admin | Show "admins only" |
| `EMAIL_TAKEN` | 409 | Email already registered | Highlight the email field |
| `ALREADY_APPLIED` | 409 | Duplicate application for this opportunity | Tell the user, don't retry |
| `RATE_LIMITED` | 429 | Too many attempts | Ask them to wait |

---

## Authentication

Two tokens. **The access token is deliberately short-lived (1 minute)**; the
refresh token is what keeps the user logged in.

| Token | Lifetime | Sent as | Purpose |
|---|---|---|---|
| `accessToken` | **1 minute** (`JWT_ACCESS_EXPIRES_IN`) | `Authorization: Bearer <token>` | Authenticates every request |
| `refreshToken` | 7 days (`JWT_REFRESH_EXPIRES_IN`) | JSON body of `POST /api/auth/refresh` | Mints a new access token |

They are signed with different secrets and carry a `type` claim (`access` /
`refresh`) that the server enforces, so one can never be used in place of the
other.

**The flow the frontend implements** (`src/api/axios.js`):

```
request --> 401 { code: "TOKEN_EXPIRED" }
        --> POST /api/auth/refresh { refreshToken }      (one at a time)
        <-- 200 { accessToken, refreshToken }            (both rotated)
        --> retry the original request --> 200
```

If the refresh itself fails, the session is over: clear both tokens and go to
`/login`.

### POST `/api/auth/register`
Body: `name` (2–80), `email`, `password` (6–72). `role` in the body is **ignored** —
new accounts are always `user`.
`201` → `{ user, accessToken, refreshToken, accessTokenExpiresIn }`
`409 EMAIL_TAKEN` if the email exists.

### POST `/api/auth/login`
Body: `email`, `password`.
`200` → `{ user, accessToken, refreshToken, accessTokenExpiresIn }`
`401 BAD_CREDENTIALS` — identical for an unknown email and a wrong password, so
the response can't be used to enumerate accounts.

### POST `/api/auth/refresh`
Body: `{ "refreshToken": "..." }` — **no** `Authorization` header needed.
`200` → a new `{ user, accessToken, refreshToken }`; both tokens are rotated.
`401` with `REFRESH_EXPIRED` / `REFRESH_INVALID` / `REFRESH_REVOKED`.

### POST `/api/auth/logout`  (requires a valid access token)
Increments the user's `tokenVersion`, which invalidates **every** refresh token
issued to that account. `200`.

### GET `/api/auth/me`  (requires a valid access token)
`200` → `{ _id, name, email, role }`.

---

## Endpoints overview

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | any | Health check — returns JSON, proves server is up |
| GET | `/api/domains` | any | The fixed domain list used by filters and forms |
| POST | `/api/auth/register` | any | Create an account (rate limited) |
| POST | `/api/auth/login` | any | Log in (rate limited) |
| POST | `/api/auth/refresh` | any | Exchange a refresh token for a new access token |
| POST | `/api/auth/logout` | user | Revoke this account's refresh tokens |
| GET | `/api/auth/me` | user | Current user |
| GET | `/api/opportunities` | any | List all (supports `?search=` and `?domain=`) |
| GET | `/api/opportunities/:id` | any | Single opportunity |
| POST | `/api/opportunities` | admin | Create |
| PUT | `/api/opportunities/:id` | admin | Update |
| DELETE | `/api/opportunities/:id` | admin | Delete |
| POST | `/api/applications` | user | Submit an application (multipart) |
| GET | `/api/applications` | admin | List all (`?opportunityId=` `?status=` `?domain=` `?company=`) |
| GET | `/api/applications/me` | user | The caller's own applications |
| GET | `/api/applications/stats` | admin | Dashboard counts |
| PATCH | `/api/applications/:id/status` | admin | Approve / reject |

---

## Field rules

Enforced by **Joi** in `backend/src/validation/schemas.js` (one schema per
endpoint, run as route middleware) and mirrored in
`frontend/src/utils/validationRules.js`. **Change one, change both.**

The Mongoose models carry **no** `required` / `match` / `enum` field validators.
Validation happens once, at the request boundary, so there is a single rulebook
rather than two that can disagree. The models keep only structural concerns:
types, refs, defaults, `trim`/`lowercase` normalisation, and indexes.

| Entity | Field | Required | Rule |
|---|---|---|---|
| Register | `name` | yes | 2–80 chars |
| | `email` | yes | valid, ≤254, stored lowercase |
| | `password` | yes | 6–72 chars |
| Login | `email`, `password` | yes | valid / non-empty |
| Opportunity | `title` | yes | 3–120 |
| | `company` | yes | 2–100 |
| | `domain` | yes | one of the fixed domain list |
| | `type` | yes | `Internship` or `Job` |
| | `description` | yes | 20–3000 |
| | `location` | no | ≤120 |
| | `experience` | no | ≤80 |
| | `stipendOrSalary` | no | ≤100 |
| | `applicationLink` | no | `http(s)://…`, ≤500 |
| | `requirements` | no | ≤12 items, each ≤80 (array or comma string) |
| Application | `opportunityId` | yes | valid ObjectId that exists |
| | `name` | yes | 2–80 |
| | `email` | yes | valid |
| | `phone` | yes | 7–20 chars, digits and `+ ( ) -` |
| | **resume** | yes | a `resume` file (PDF/DOC/DOCX, ≤5 MB) **or** a `resumeLink` URL |
| | `coverNote` | no | ≤1000 |
| Status update | `:id` | yes | valid ObjectId |
| | `status` | yes | `Pending` / `Approved` / `Rejected` |
| Query filters | `search`, `company` | no | ≤100, regex-escaped before use |
| | `domain`, `status` | no | must match the enum |
| | `opportunityId` | no | valid ObjectId |

Unlisted body fields are **dropped**, not merely ignored — controllers read a
whitelisted `req.valid` rather than `req.body`, so `_id`, `role`, `userId` and
`status` can never be set by a client.

---

## Opportunity endpoints

### GET `/api/opportunities`
List opportunities. **Search and filter both happen here** via query params — one endpoint does both.

Query params (all optional):
- `search` → case-insensitive regex match on `title` OR `company`
- `domain` → exact match against the fixed domain list

Examples:
- `/api/opportunities`
- `/api/opportunities?search=front`
- `/api/opportunities?domain=Web Development`
- `/api/opportunities?search=intern&domain=Data Science`

Response `200`:
```json
{ "success": true, "data": [ { "_id": "...", "title": "...", "...": "..." } ], "message": "Opportunities fetched" }
```

### GET `/api/opportunities/:id`
- Valid id, found → `200` with the object
- Invalid ObjectId format → `400`
- Well-formed id but not in DB → `404`

### POST `/api/opportunities`  (admin)
Request body:
```json
{
  "title": "Frontend Developer Intern",
  "company": "Acme Corp",
  "domain": "Web Development",
  "type": "Internship",
  "location": "Remote",
  "experience": "Fresher",
  "description": "Build UI with React...",
  "stipendOrSalary": "₹15,000/month",
  "applicationLink": "https://acme.com/careers/123",
  "requirements": ["React", "CSS"]
}
```
- Success → `201` with the created object (including `_id`)
- Missing required field (title/company/domain/type/description) → `400`

### PUT `/api/opportunities/:id`  (admin)
- Body: the **full** record — PUT replaces, so the same required fields as POST apply
- Uses `findByIdAndUpdate(id, validatedBody, { new: true, runValidators: true })`
- Success → `200` with the **updated** object
- Invalid id or failing field → `400` · not found → `404`

### DELETE `/api/opportunities/:id`  (admin)
- Success → `200` with a confirmation message
- Invalid id → `400` · not found → `404`

---

## Application endpoints

### POST `/api/applications`  (user)
Sent as **`multipart/form-data`** so a resume file can be attached:

| Field | Notes |
|---|---|
| `opportunityId` | required, must exist |
| `name` | required, 2–80 |
| `email` | required, valid |
| `phone` | required, 7–20 chars, digits and `+ ( ) -` |
| `resume` | file — PDF/DOC/DOCX, ≤5 MB |
| `resumeLink` | `http(s)://…` alternative to the file |
| `coverNote` | optional, ≤1000 |

**Either `resume` or `resumeLink` must be present.** When a file is uploaded it
wins, and the stored `resumeLink` becomes its Cloudinary URL.

`userId` is always taken from the authenticated token — sending it in the body
has no effect.

- Success → `201` with the created application
- Failing field, or neither resume nor link → `400` (the resume rule reports under `errors.resume`)
- Rejected file type or a file over 5 MB → `400`
- Cloudinary not configured but a file was sent → `503`
- `opportunityId` well-formed but not in DB → `404`
- Same user applying to the same opportunity twice → `409 ALREADY_APPLIED`
  (enforced by a unique index on `(userId, opportunityId)`)

### GET `/api/applications`  (admin)
Query params (all optional, all validated): `opportunityId`, `status`, `domain`, `company`.
`company` is a case-insensitive match and is regex-escaped before use.
Uses `.populate()` so each application includes the opportunity's title/company.
Response `200` with an array.

### GET `/api/applications/me`  (user)
The caller's own applications only — filtered by `req.user._id`, never by a
client-supplied id. Response `200` with an array.

### PATCH `/api/applications/:id/status`  (admin)
Body: `{ "status": "Approved" }` — must be `Pending`, `Approved`, or `Rejected`.
Sets `reviewedAt`/`reviewedBy`, emails the applicant on a real change.
`200` with the updated (populated) application · invalid id or status → `400` · not found → `404`.

---

## Error handling rules
- Validation is **Joi**, running as **route middleware before the controller**
  (`middleware/validate.js` + `validation/schemas.js`), not inside handlers
- Joi runs with `abortEarly: false`, so one pass collects **all** field errors
  rather than failing on the first
- Joi runs with `stripUnknown: true`, so undeclared keys are dropped, not just ignored
- **No field validators on the Mongoose models** — the API boundary is the single
  authority, which also means records written before a rule existed can still be
  updated instead of failing validation on a field the request never touched
- Controllers read `req.valid.{body,query,params}` — **never** `req.body` — so
  unlisted fields cannot reach the database
- Any value used to build a `RegExp` is escaped first (`utils/escapeRegex.js`);
  otherwise `?search=(a+)+$` is a denial-of-service payload
- Non-string input (`{"email":{"$gt":""}}`) coerces to `''` and is rejected as
  missing, which is what blocks NoSQL operator injection
- Wrap every async controller so thrown errors reach the central `errorHandler`
- Invalid ObjectId → `400`, never a `500`
- Unknown routes → `notFound` middleware returns `404` in the same envelope
- Never trust client input — the server validates everything even though the
  frontend also validates
