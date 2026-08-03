# Internship & Job Listing Portal

A full-stack **MERN** (MongoDB · Express · React · Node) job and internship board.

Candidates browse opportunities, search and filter them by domain, read the full
posting, and apply with a resume upload or a link. Admins publish and manage
listings and review every application, approving or rejecting each one — which
emails the applicant automatically.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 (Vite) · React Router 7 · Axios |
| Backend | Node.js · Express 4 |
| Database | MongoDB (Mongoose 8) |
| Auth | JWT access + refresh tokens, revocable server-side |
| Validation | Joi at the request boundary, mirrored client-side |
| Uploads | Cloudinary (via Multer) |
| Email | Nodemailer (Gmail app password) |
| Tests | `node:test` · Supertest · mongodb-memory-server |

## Features

**Candidate** — register and log in · browse paginated opportunities · search by
title or company · filter by domain · view full details · apply with a resume
file or link · receive a confirmation email · track every application and its
status on a personal dashboard.

**Admin** — publish, edit, close, reopen, and archive listings · review all
applications with domain, company, and status filters · preview resumes ·
approve or reject, which notifies the applicant by email · dashboard totals
broken down by status, domain, and company.

All four bonus features from the assignment brief are implemented: admin
authentication, user authentication, resume upload, and email notification.

## Project structure

```
jobportal-main/
├── backend/                 # Express + MongoDB API
│   ├── server.js            # entry point: env, DB, listen, graceful shutdown
│   ├── src/
│   │   ├── app.js           # Express app — importable without listening
│   │   ├── config/          # db, cloudinary, shared constants
│   │   ├── controllers/     # auth, opportunities, applications
│   │   ├── middleware/      # auth, validate, rateLimit, errorHandler, notFound
│   │   ├── models/          # User, Opportunity, Application, RefreshToken
│   │   ├── routes/          # route tables
│   │   ├── services/        # sessions (refresh-token lifecycle)
│   │   ├── scripts/         # one-off migrations
│   │   ├── utils/           # tokens, paginate, escapeHtml, escapeRegex, …
│   │   └── validation/      # Joi schemas — the source of truth for input
│   └── tests/               # 66 integration + unit tests
├── frontend/                # React (Vite) single-page app
│   └── src/
│       ├── api/             # axios instance + token store
│       ├── components/      # Navbar, OpportunityCard, Pagination, Toast, …
│       ├── context/         # AuthContext
│       ├── hooks/           # useFormValidation
│       ├── layouts/         # MainLayout
│       ├── pages/           # public pages + pages/admin
│       └── utils/           # validationRules (mirrors the Joi schemas)
├── docs/                    # data model, API contract, UI pages, flow, specs
├── ROADMAP.md
└── README.md
```

## Getting started

**Prerequisites:** Node.js 18+ and either a local MongoDB or a MongoDB Atlas
connection string.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # then edit it — see the table below
npm run seed             # sample opportunities + a default admin account
npm run dev              # http://localhost:5000
```

`npm run seed` prints the admin credentials it created (default
`admin@portal.com` / `admin123`). Change these before deploying anywhere.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

### 3. Confirm it works

```bash
curl http://localhost:5000/api/health
```

Returns `200` with `"database": "connected"`. A `503` means the API is running
but cannot reach MongoDB.

## Environment variables

### backend/.env

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no | API port (default `5000`) |
| `NODE_ENV` | no | `production` switches to combined request logs |
| `MONGO_URI` | **yes** | MongoDB connection string |
| `CORS_ORIGINS` | in production | Comma-separated allow-list of browser origins. Defaults to the local Vite dev servers |
| `JWT_SECRET` | **yes** | Fallback secret if the two below are blank |
| `JWT_ACCESS_SECRET` | recommended | Signs access tokens |
| `JWT_REFRESH_SECRET` | recommended | Signs refresh tokens — must differ from the access secret |
| `JWT_ACCESS_EXPIRES_IN` | no | Access token lifetime (default `1m`) |
| `JWT_REFRESH_EXPIRES_IN` | no | Session ceiling (default `7d`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | no | Admin account created by `npm run seed` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | no | Resume file uploads. Without all three, uploads are refused with a clear message and applicants must supply a resume link instead |
| `EMAIL_USER` / `EMAIL_PASS` | no | Gmail address and **app password** for notifications. Unset, emails are skipped and logged rather than failing the request |

### frontend/.env

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | **yes** | Backend base URL including `/api` |
| `VITE_CLOUDINARY_CLOUD_NAME` | no | Restricts inline resume previews to files from your own cloud |

Everything in a Vite `.env` is compiled into the public bundle. Never put a
secret there.

## Scripts

### backend

| Command | Does |
| --- | --- |
| `npm run dev` | Start with nodemon |
| `npm start` | Start for production |
| `npm test` | Run the full test suite (spins up an in-memory MongoDB) |
| `npm run seed` | Reset opportunities/applications/sessions and create the admin |
| `npm run backfill:status` | One-off migration — see below |

### frontend

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | oxlint |

## Data model

Four collections. Full field-by-field detail in
[docs/data-model.md](docs/data-model.md).

**User** — `name`, `email` (unique), `password` (bcrypt, `select: false`),
`role` (`user` | `admin`, server-assigned only), `tokenVersion`.

**Opportunity** — `title`, `company`, `domain`, `type` (`Internship` | `Job`),
`location`, `experience`, `description`, `stipendOrSalary`, `applicationLink`,
`requirements[]`, and `status`.

`status` is the lifecycle: `draft` → `open` → `closed` → `archived`. Only `open`
listings are publicly visible or accept applications. **`DELETE` archives rather
than destroys**, so an applicant's record of a role never points at a document
that vanished.

**Application** — `opportunityId`, `userId`, `name`, `email`, `phone`,
`resumeLink`, `coverNote`, `status` (`Pending` | `Approved` | `Rejected`),
`reviewedAt`, `reviewedBy`. A unique index on `(userId, opportunityId)` enforces
one application per person per role at the database level, so two concurrent
submissions cannot both succeed.

**RefreshToken** — one row per live session: `userId`, `tokenHash` (SHA-256 —
the raw token is never stored), `familyId`, `expiresAt` (TTL-indexed for
automatic cleanup), `revokedAt`, `replacedBy`.

## How auth works

Two tokens, signed with separate secrets and carrying a `type` claim so neither
can be replayed as the other:

- **Access token** — 1 minute, sent as `Authorization: Bearer …`.
- **Refresh token** — 7 days, accepted only by `POST /api/auth/refresh`.

Every refresh **rotates** the pair: the presented token is revoked and a
successor issued in the same family. Because exactly one token per family is
live at a time, presenting an already-rotated token proves a copy is in
circulation — so the entire family is revoked rather than served. A stolen
refresh token is therefore useful only until the real user next refreshes, and
the theft announces itself.

Logout ends **only the calling device's** session, identified by the `sid` claim
on its access token. Other devices stay signed in.

On the client, one Axios instance attaches the access token and single-flights
the refresh: three requests failing at once await the same refresh promise
instead of racing three rotations that would invalidate each other.

## Validation

`backend/src/validation/schemas.js` is the single authority for what the API
accepts. It runs as route middleware before any controller and exposes a
whitelisted copy on `req.valid`, which controllers read instead of `req.body`.
Joi's `stripUnknown` is what guarantees an unexpected key — `role`, `userId`,
`status` — can never reach the database.

The Mongoose models deliberately carry no `required` validators. One rulebook,
at the request boundary, rather than two that can quietly disagree.
`frontend/src/utils/validationRules.js` mirrors it field for field so the user
sees the same message the server would have produced.

## API

Full request/response detail in [docs/api-contract.md](docs/api-contract.md).
Every response is `{ success, data, message }`; list endpoints add `meta`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | any | Liveness + database reachability |
| GET | `/api/domains` | any | The fixed domain list used by filters |
| POST | `/api/auth/register` | any | Create an account (rate limited) |
| POST | `/api/auth/login` | any | Log in (rate limited) |
| POST | `/api/auth/refresh` | any | Rotate the token pair |
| POST | `/api/auth/logout` | user | End this session |
| GET | `/api/auth/me` | user | Current user |
| GET | `/api/opportunities` | any | Paginated list (`?search=` `?domain=` `?page=` `?limit=`). Admins also get `?status=` |
| GET | `/api/opportunities/:id` | any | Single listing — non-`open` is admin-only |
| POST | `/api/opportunities` | admin | Create |
| PUT | `/api/opportunities/:id` | admin | Update (cannot change `status`) |
| PATCH | `/api/opportunities/:id/status` | admin | Move through the lifecycle |
| DELETE | `/api/opportunities/:id` | admin | Archive |
| POST | `/api/applications` | user | Apply (multipart or JSON) |
| GET | `/api/applications` | admin | Paginated list (`?opportunityId=` `?status=` `?domain=` `?company=`) |
| GET | `/api/applications/me` | user | The caller's own history, with a status summary |
| GET | `/api/applications/stats` | admin | Dashboard counts |
| PATCH | `/api/applications/:id/status` | admin | Approve / reject |

### Pagination

List endpoints accept `?page=` and `?limit=` and return:

```json
{
  "success": true,
  "data": [ /* … */ ],
  "meta": { "page": 1, "limit": 12, "total": 57, "totalPages": 5, "hasNext": true },
  "message": "Opportunities fetched"
}
```

`limit` is capped server-side (50 public, 100 admin), so a client cannot request
the whole collection.

## Testing

```bash
cd backend
npm test
```

66 tests across auth, opportunities, applications, and the pure utilities. They
run against a real MongoDB started in-memory, so index-level behaviour — the
unique-application constraint, the TTL on sessions — is genuinely exercised
rather than mocked.

The suite covers, among others: privilege escalation via a `role` field in the
register body, refresh-token reuse revoking a whole family, logout leaving other
devices signed in, non-`open` listings staying invisible to the public, applying
to a closed role, and pagination arithmetic.

## Deployment

Backend on **Render**, frontend on **Vercel**, database on **MongoDB Atlas**.
[`render.yaml`](render.yaml) and [`frontend/vercel.json`](frontend/vercel.json)
are included.

1. **Atlas** — create a free cluster, add a database user, allow access from
   anywhere (`0.0.0.0/0`) so Render can reach it, and copy the connection string.
2. **Render** — new Web Service from this repo, root directory `backend`, build
   `npm install`, start `npm start`. Set `MONGO_URI`, `JWT_*`, `NODE_ENV=production`,
   and the Cloudinary/email vars. Leave `CORS_ORIGINS` for step 4.
3. **Vercel** — new project, root directory `frontend`, framework Vite. Set
   `VITE_API_URL` to `https://<your-render-service>.onrender.com/api`.
4. **Close the loop** — set `CORS_ORIGINS` on Render to your Vercel URL and
   redeploy. Until you do, the browser will refuse the cross-origin calls.
5. **If you had data before the lifecycle change**, run the migration once:
   `npm run backfill:status`. It sets `status: 'open'` on opportunities created
   before the field existed — without it those listings are invisible, because
   Mongoose defaults do not apply retroactively.

Note that Render's free tier sleeps when idle, so the first request after a
quiet period takes a few seconds.

## Known limitations

Recorded deliberately rather than left to be discovered:

- **`?search=` is not indexed.** It compiles to a case-insensitive unanchored
  `$regex`, which no B-tree index can serve, so searching scans the collection.
  A `$text` index would be indexable but matches whole stemmed words, so `fron`
  would stop matching `Frontend Developer` and break search-as-you-type. The
  proper fix is Atlas Search with an autocomplete analyzer. Filtering and
  browsing *are* indexed.
- **Tokens live in `localStorage`.** Refresh tokens are now revocable, which
  bounds a leak, but any XSS still exposes them. Moving the refresh token to an
  httpOnly cookie is the next step.
- **One global `admin` role.** There are no per-employer accounts, so admins see
  every listing rather than only their own company's.
- **No server-rendered pages.** Fine for an application portal, limiting for a
  public job board that wants search-engine traffic.

## Documentation

- [Data model](docs/data-model.md)
- [API contract](docs/api-contract.md)
- [UI pages & routes](docs/ui-pages.md)
- [Application flow](docs/flow-diagram.md)
- [Design specs](docs/superpowers/specs/)
- [Full roadmap](ROADMAP.md)
