# Internship & Job Listing Portal — Complete Implementation Roadmap

> A phase-by-phase mentor's blueprint for building a MERN-stack (MongoDB, Express, React, Node) job/internship portal.
> **Rule of thumb:** Build & verify the backend fully before touching the frontend. Commit after every milestone. Don't move forward until each phase's ✅ checkpoint is green.

**Stack:** React.js · Node.js · Express.js · MongoDB (Mongoose) · REST APIs · Axios

---

## 🗺️ The Big Picture

```
Phase 0  → Requirement Analysis & Planning   (no code, pure thinking)
Phase 1  → Backend Foundation                (Express + Mongo + env + structure)
Phase 2  → Database Models                    (Opportunity, Application)
Phase 3  → CRUD + Query APIs                   (the heart of the backend)
Phase 4  → Frontend Foundation                (React + routing + layout + Axios)
Phase 5  → Listing Page                        (fetch & display opportunities)
Phase 6  → Details Page                        (single opportunity)
Phase 7  → Search & Filter                     (query params end-to-end)
Phase 8  → Application Form + Confirmation      (user submits, gets confirmation)
Phase 9  → Admin Dashboard                      (add/edit/delete + view applications)
Phase 10 → Full Integration & Polish            (wire everything, error/loading states)
Phase 11 → Testing                              (manual + automated checklist)
Phase 12 → Deployment                           (ship it live)
Phase 13 → (Optional) Auth & Hardening          (real-world admin protection)
```

---

## PHASE 0 — Requirement Analysis & Planning

> The phase beginners skip and seniors never skip. No code. Just thinking on paper.

**Goal:** Fully understand *what* you're building and *how the data flows* before writing a line.

**Why:** Every hour planning saves ~10 hours of rework. If the data model is wrong, everything on top is wrong.

**Deliverables (put in `/docs`):**
- `docs/flow-diagram.png` — draw the user & admin journeys (pen/paper, draw.io, or Excalidraw)
- `docs/data-model.md`
- `docs/api-contract.md`
- `docs/ui-pages.md`

**User journey:**
```
Listing Page → (search + domain filter) → click card → Details Page
→ click "Apply" → Application Form → submit → Confirmation screen
```

**Admin journey:**
```
Admin Dashboard → Add / Edit / Delete Opportunity → View All Applications
```

### Database Models (plan now)

**Opportunity**
| Field | Type | Notes |
|---|---|---|
| title | String | required |
| company | String | required |
| domain | String | required — the filter key (e.g. "Web Development", "Data Science") |
| type | String | enum: "Internship" / "Job" |
| location | String | e.g. "Remote", "Bangalore" |
| description | String | long text |
| stipend / salary | String or Number | optional |
| requirements | [String] or String | skills |
| createdAt | Date | auto (timestamps) |

**Application**
| Field | Type | Notes |
|---|---|---|
| opportunityId | ObjectId (ref → Opportunity) | which opportunity |
| name | String | required |
| email | String | required, validated |
| phone | String | optional |
| resumeLink | String (URL) | link, not a file upload (v1) |
| coverNote | String | optional |
| createdAt | Date | auto |

> **Mentor note:** For v1, store the resume as a **URL** (Google Drive link). File uploads (Multer, cloud storage) add a lot of complexity — save for v2.

### API Contract
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/opportunities` | list all (supports `?search=` & `?domain=`) |
| GET | `/api/opportunities/:id` | single opportunity |
| POST | `/api/opportunities` | admin: create |
| PUT | `/api/opportunities/:id` | admin: update |
| DELETE | `/api/opportunities/:id` | admin: delete |
| POST | `/api/applications` | user: apply |
| GET | `/api/applications` | admin: view all (supports `?opportunityId=`) |

**Best practices:** decide naming conventions (camelCase vars, kebab-case URLs, PascalCase components) and a consistent API response shape `{ success, data, message }`.

**Common mistakes:** coding before knowing data shape · over-engineering (no accounts/payments/notifications for v1) · forgetting the `domain` field.

**When to commit:** `git init`, add `README.md` + `.gitignore`, commit `docs/`.
`docs: add project planning, data model, and API contract`

**✅ Milestone:** You can narrate the full data flow out loud without hesitation.

---

## PHASE 1 — Backend Foundation

**Goal:** A running Express server connected to MongoDB, clean structure, env config.

**Why:** The backend is the source of truth. Build & test it in isolation so React later becomes "just" a display layer.

**Folder structure:**
```
server/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── models/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   └── app.js
├── .env
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

**Files & responsibilities:**
| File | Responsibility |
|---|---|
| `server.js` | Entry point: load env, start HTTP server, call DB connect |
| `src/app.js` | Create Express app, register global middleware (JSON parser, CORS), mount routes |
| `src/config/db.js` | Connect to MongoDB via Mongoose; log success/failure |
| `.env` | Secrets: `PORT`, `MONGO_URI` — **never committed** |
| `.env.example` | Same keys, dummy values — **committed** |
| `.gitignore` | Must include `node_modules`, `.env` |
| `src/middleware/` | Error handler & 404 handler (create early) |

**Packages:** `express`, `mongoose`, `dotenv`, `cors`, `nodemon` (dev). Know *why* each is used.

**Best practices:** split `app.js` from `server.js` · centralize DB connection · create global error + 404 handlers early · consistent response shape.

**Common mistakes:** committing `.env` · hardcoding URI/port · forgetting `express.json()` (→ `req.body` undefined) · forgetting CORS.

**When to commit:** `chore: initialize express server with mongodb connection`

**✅ Milestone:** `GET /api/health` returns JSON; console shows "MongoDB connected". No real routes yet.

---

## PHASE 2 — Database Models

**Goal:** Define Mongoose schemas for `Opportunity` and `Application`.

**Why:** Models enforce structure & validation at the data layer, preventing bad data.

**Folder structure:**
```
src/models/
├── Opportunity.js
└── Application.js
```

**Responsibilities:**
| File | Responsibility |
|---|---|
| `Opportunity.js` | Schema + validation + timestamps; export model |
| `Application.js` | Schema with `ref: 'Opportunity'` on `opportunityId` |

**Validation rules:** required fields (title/company/domain/type for Opportunity; name/email/opportunityId for Application) · `type` enum `['Internship','Job']` · email `match` regex · `timestamps: true` · `trim: true`.

**Best practices:** enum for fixed choices · consistent `domain` values (fixed list) to keep filtering predictable.

**Common mistakes:** free-text `domain` with inconsistent casing → filter breaks · forgetting `ref` → can't `populate()` later.

**When to commit:** `feat: add Opportunity and Application mongoose models`

**✅ Milestone:** Insert one valid doc (see it in Atlas), invalid doc rejected. Delete the test doc.

---

## PHASE 3 — CRUD + Query APIs (core backend)

**Goal:** Build all REST endpoints; test each in Postman.

**Why:** The product's engine. Once endpoints are correct & handle errors, the frontend is easy.

**Folder structure:**
```
src/
├── controllers/
│   ├── opportunityController.js
│   └── applicationController.js
├── routes/
│   ├── opportunityRoutes.js
│   └── applicationRoutes.js
└── middleware/
    ├── errorHandler.js
    └── notFound.js
```

**Responsibilities:**
| File | Responsibility |
|---|---|
| `opportunityRoutes.js` | Map URLs → controllers; mounted at `/api/opportunities` |
| `applicationRoutes.js` | Mounted at `/api/applications` |
| `opportunityController.js` | create, getAll (search/filter), getById, update, delete |
| `applicationController.js` | createApplication, getApplications (optional `opportunityId`) |
| `errorHandler.js` | Consistent JSON errors + status codes |
| `notFound.js` | 404 for unknown routes |

**Endpoints & DB operation:**
| Endpoint | Function | Mongoose op |
|---|---|---|
| `POST /api/opportunities` | createOpportunity | `Opportunity.create()` |
| `GET /api/opportunities` | getOpportunities | `Opportunity.find(query)` |
| `GET /api/opportunities/:id` | getOpportunityById | `findById()` |
| `PUT /api/opportunities/:id` | updateOpportunity | `findByIdAndUpdate(...,{new:true, runValidators:true})` |
| `DELETE /api/opportunities/:id` | deleteOpportunity | `findByIdAndDelete()` |
| `POST /api/applications` | createApplication | `Application.create()` |
| `GET /api/applications` | getApplications | `find().populate('opportunityId')` |

**Search & filter logic (in `getOpportunities`):** read `req.query.search` & `req.query.domain`; build a query object — `search` → case-insensitive regex on title/company; `domain` → exact match; pass to `.find()`. **Search and filter are just a MongoDB query object built from URL params — one endpoint does both.**

**Validation & error handling:** invalid ObjectId → 400 (not 500) · missing fields → 400 · not found → 404 · wrap async controllers so errors reach `errorHandler` · proper codes (201 create, 200 read/update).

**Best practices:** thin routes, fat controllers · consistent response envelope · never trust client input.

**Common mistakes:** forgetting `{ new: true }` · forgetting `runValidators: true` · unhandled invalid ObjectId · string equality instead of regex for search.

**Testing checklist (Postman — before ANY frontend):**
- [ ] Create → 201 with `_id`
- [ ] Create missing title → 400
- [ ] Get all → array
- [ ] `?search=front` → filtered
- [ ] `?domain=Web Development` → filtered
- [ ] Get by valid/invalid/nonexistent id → object / 400 / 404
- [ ] Update → 200, changes reflected
- [ ] Delete → 200, then get → 404
- [ ] Create application → 201
- [ ] Get applications → populated opportunity title

**When to commit (per resource):**
`feat: opportunity CRUD endpoints` · `feat: search and domain filter on opportunities` · `feat: application submission and listing endpoints` · `feat: global error handling and 404 middleware`

**✅ Milestone:** Entire backend works in Postman with zero frontend. Export the Postman collection to `/docs`. **Most important checkpoint in the project.**

---

## PHASE 4 — Frontend Foundation

**Goal:** Running React app with routing, shared layout, configured Axios client.

**Why:** Build the "chassis" so feature pages slot in.

**Stack note:** Prefer **Vite** over CRA (faster).

**Folder structure:**
```
client/
├── src/
│   ├── api/
│   │   └── axios.js
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   ├── OpportunityCard.jsx
│   │   ├── SearchBar.jsx
│   │   ├── FilterDropdown.jsx
│   │   └── Loader.jsx
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── OpportunityDetailsPage.jsx
│   │   ├── ApplyPage.jsx
│   │   ├── ConfirmationPage.jsx
│   │   └── admin/
│   │       ├── AdminDashboard.jsx
│   │       ├── AddOpportunity.jsx
│   │       ├── EditOpportunity.jsx
│   │       └── ViewApplications.jsx
│   ├── layouts/
│   │   └── MainLayout.jsx
│   ├── App.jsx
│   └── main.jsx
├── .env            (VITE_API_URL=...)
└── package.json
```

**Responsibilities:**
| File | Responsibility |
|---|---|
| `main.jsx` | App entry; wrap `<App>` in `<BrowserRouter>` |
| `App.jsx` | Route table |
| `layouts/MainLayout.jsx` | Navbar + `<Outlet/>` + Footer |
| `api/axios.js` | Axios instance with `baseURL` from env — every call imports this |
| `components/*` | Reusable dumb components |
| `pages/*` | Route-level smart components that fetch |

**Routing table:**
| Path | Page |
|---|---|
| `/` | HomePage (listing) |
| `/opportunities/:id` | OpportunityDetailsPage |
| `/opportunities/:id/apply` | ApplyPage |
| `/confirmation` | ConfirmationPage |
| `/admin` | AdminDashboard |
| `/admin/add` | AddOpportunity |
| `/admin/edit/:id` | EditOpportunity |
| `/admin/applications` | ViewApplications |

**State management:** No Redux needed. Use `useState`, `useEffect`, prop passing. Add Context only if you add auth.

**Best practices:** one central Axios instance · separate presentational vs page components · `VITE_API_URL` in env, never hardcode `localhost`.

**Common mistakes:** hardcoding API URL everywhere · giant single component · forgetting `<BrowserRouter>`.

**When to commit:** `chore: scaffold react app with router, layout, and axios client`

**✅ Milestone:** Navigate between empty placeholder pages via navbar; each renders inside the shared layout.

---

## PHASE 5 — Opportunity Listing Page

**Goal:** Fetch opportunities and display as cards.

**Why:** First real end-to-end flow: React → Axios → Express → Mongo → screen.

**Files:**
| File | Responsibility |
|---|---|
| `pages/HomePage.jsx` | On mount fetch `GET /api/opportunities`; hold `opportunities/loading/error`; map to cards |
| `components/OpportunityCard.jsx` | Props → title, company, domain, type, location; link to details |
| `components/Loader.jsx` | Spinner while loading |

**Data flow:**
```
HomePage mounts → useEffect → axios.get('/opportunities')
→ setLoading(true) → await → setOpportunities → setLoading(false)
→ render: loading ? <Loader/> : opportunities.map(<OpportunityCard/>)
```

**Three-states rule (every fetching page):** Loading → `<Loader/>` · Error → friendly message · Empty → "No opportunities found".

**Common mistakes:** missing loading/error/empty states · missing `key` prop · no try/catch · fetch outside `useEffect` (infinite loop).

**Testing checklist:**
- [ ] Cards render
- [ ] Loader shows briefly
- [ ] Backend down → error message
- [ ] Empty DB → "no opportunities" message

**When to commit:** `feat: opportunity listing page with loading and error states`

**✅ Milestone:** `/` shows real DB data as cards.

---

## PHASE 6 — Opportunity Details Page

**Goal:** Show full details for one opportunity, reached by clicking a card.

**Why:** Teaches route params (`useParams`) and single-resource fetching (reused in editing).

**Files:**
| File | Responsibility |
|---|---|
| `pages/OpportunityDetailsPage.jsx` | Read `:id` via `useParams`; fetch by id; render detail; Apply button → `/opportunities/:id/apply` |

**Data flow:**
```
Card clicked → /opportunities/:id → read id → axios.get(`/opportunities/${id}`)
→ render details + Apply button
```

**Error handling:** nonexistent id → 404 → "Opportunity not found" + link home.

**Common mistakes:** not handling not-found · hardcoding id instead of `useParams`.

**Testing checklist:**
- [ ] Correct opportunity opens
- [ ] All fields display
- [ ] Bad id → graceful not-found
- [ ] Apply routes correctly

**When to commit:** `feat: opportunity details page`

**✅ Milestone:** Click card → detail page → Apply leads to apply page.

---

## PHASE 7 — Search & Filter

**Goal:** Search by keyword and filter by domain, powered by backend query params.

**Why:** Reinforces that the frontend just changes the query string; the backend filters (scalable & correct).

**Files:**
| File | Responsibility |
|---|---|
| `components/SearchBar.jsx` | Controlled input; lifts term to HomePage |
| `components/FilterDropdown.jsx` | Domain dropdown; lifts selection |
| `pages/HomePage.jsx` (updated) | Holds `search` & `domain`; refetch with params on change |

**Data flow:**
```
User types/selects → HomePage state updates → useEffect [search, domain]
→ axios.get('/opportunities', { params: { search, domain } }) → re-render
```

**State management:** `search` & `domain` live in HomePage, passed to children (lifting state up).

**Best practices:** use Axios `params` (don't hand-build query strings) · **debounce** search input (~300–500ms) · keep domain list in sync with backend enum.

**Common mistakes:** filtering in the browser instead of server · no debounce · missing deps in `useEffect`.

**Testing checklist:**
- [ ] Typing narrows results
- [ ] Domain filters
- [ ] Combined works
- [ ] Clearing restores full list
- [ ] No result → message

**When to commit:** `feat: server-side search and domain filtering`

**✅ Milestone:** Search + filter change the list in real time via backend queries.

---

## PHASE 8 — Application Form + Confirmation

**Goal:** User fills a form, submits an application, sees confirmation.

**Why:** First POST from the UI — controlled forms, validation, submit handling, post-submit navigation.

**Files:**
| File | Responsibility |
|---|---|
| `pages/ApplyPage.jsx` | Controlled form; validate; `POST /api/applications` with `opportunityId` from URL; success → confirmation |
| `pages/ConfirmationPage.jsx` | Success message + link back to listings |

**Data flow:**
```
Fill form → Submit → validate client-side
→ axios.post('/applications', { opportunityId, ...formData })
→ success → navigate('/confirmation') | failure → show error, keep data
```

**Validation rules:** client-side — name required, valid email, resumeLink is URL · server-side re-validates · disable submit while in flight.

**Common mistakes:** uncontrolled inputs · no submit-disable (double submit) · client-only validation · losing data on failure.

**Testing checklist:**
- [ ] Empty required fields blocked
- [ ] Invalid email blocked
- [ ] Valid submit → confirmation
- [ ] Record in MongoDB with correct `opportunityId`
- [ ] Double-click doesn't create two records

**When to commit:** `feat: application form with validation and confirmation page`

**✅ Milestone:** Full user journey: browse → details → apply → confirmation, record saved.

---

## PHASE 9 — Admin Dashboard

**Goal:** Admin can add, edit, delete opportunities, and view all applications.

**Why:** Completes admin features; reuses forms/fetching/routing/deletes.

**Files:**
| File | Responsibility |
|---|---|
| `pages/admin/AdminDashboard.jsx` | Table of opportunities with Edit/Delete + Add button |
| `pages/admin/AddOpportunity.jsx` | Create form → POST |
| `pages/admin/EditOpportunity.jsx` | Fetch by id → pre-fill → PUT |
| `pages/admin/ViewApplications.jsx` | GET applications → table |

**Data flow (delete):**
```
Delete → confirm → axios.delete(`/opportunities/${id}`) → success → refetch/update state
```

**Validation & error handling:** same form validation · **always confirm before delete** · handle failed edits/deletes with a message.

**Best practices:** reuse one `<OpportunityForm>` for Add & Edit (props decide mode) — DRY · refetch/update state after mutations.

**Common mistakes:** duplicating the form · stale list after add/delete · no delete confirmation · forgetting to pre-fill edit.

**Testing checklist:**
- [ ] Add → appears in dashboard & public listing
- [ ] Edit → pre-filled; changes persist
- [ ] Delete → confirm → removed everywhere
- [ ] View applications → all submissions with opportunity titles

**When to commit:** `feat: admin dashboard - add opportunity` · `feat: admin edit and delete opportunity` · `feat: admin view all applications`

**✅ Milestone:** Every feature from the brief works front to back.

---

## PHASE 10 — Full Integration & Polish

**Goal:** Make it feel like a real product.

**Why:** Happy-path working ≠ done. Polish separates a submission from a professional project.

**What to do:** audit every page for loading/error/empty · add success/failure toasts (optional) · consistent styling · confirm CORS · remove `console.log`s & dead code · make responsive.

**Common mistakes:** leftover debug logs · inconsistent error handling · broken states when backend is slow/down.

**Testing checklist:**
- [ ] Kill backend → every page degrades gracefully
- [ ] No console errors
- [ ] Works on phone-sized screen
- [ ] All nav links correct

**When to commit:** `refactor: consistent loading/error states and UI polish`

**✅ Milestone:** Click through as fresh user and admin — nothing feels broken.

---

## PHASE 11 — Testing

**Goal:** Verify systematically; optionally add automated tests.

**Why:** Manual catches obvious bugs; automated tests prevent regressions.

**Level 1 — Manual (required):** run the full regression below.
**Level 2 — Automated (bonus):** backend `Jest` + `Supertest`; frontend `React Testing Library`.

**Regression checklist:**
- [ ] All Postman endpoints still pass
- [ ] Listing + search + filter
- [ ] Details + bad id handled
- [ ] Apply flow + confirmation
- [ ] Admin add/edit/delete
- [ ] View applications
- [ ] Invalid inputs rejected client + server
- [ ] Server-down graceful everywhere

**Common mistakes:** happy-path only · not re-testing old features.

**When to commit:** `test: add api integration tests` / `test: add component tests`

**✅ Milestone:** Someone else can't easily break the app.

---

## PHASE 12 — Deployment

**Goal:** Put the app live.

**Why:** A live link is what you show/submit; teaches production config.

**What to do:**
- **DB:** MongoDB Atlas — configure network access.
- **Backend:** Render / Railway — set env vars (`MONGO_URI`, `PORT`) in dashboard.
- **Frontend:** Vercel / Netlify — set `VITE_API_URL` to live backend URL.
- **CORS:** allow the live frontend domain.

**Common mistakes (deployment killers):** frontend still on `localhost` · CORS blocking deployed frontend · committing secrets · Atlas network rules missing.

**Testing checklist:**
- [ ] Live frontend loads live data
- [ ] Apply flow works in prod
- [ ] Admin actions work in prod
- [ ] No CORS errors

**When to commit:** `docs: add deployment URLs and instructions to README`

**✅ Milestone:** A public URL anyone can use.

---

## PHASE 13 — (Optional) Auth & Hardening

> Not in the brief, but an admin panel anyone can reach is a security hole. Mandatory in a real company; a strong differentiator for an assignment.

- `Admin` model + login endpoint issuing a **JWT**.
- Protect admin routes with **auth middleware**.
- Frontend: login page, store token, **Axios interceptor** to attach it, **ProtectedRoute** for `/admin/*`.
- Best practices: hash passwords with `bcrypt`, JWT secret in env, never store secrets in frontend.

---

## ✅ Master Build Checklist

**Phase 0 — Planning**
- [ ] Flow diagram drawn
- [ ] Data models designed
- [ ] API contract written
- [ ] Page inventory listed
- [ ] Git repo initialized

**Phase 1 — Backend Foundation**
- [ ] Node project + packages installed
- [ ] Express app + server split
- [ ] MongoDB connected
- [ ] `.env` + `.gitignore` set (env NOT committed)
- [ ] Health route returns JSON

**Phase 2 — Models**
- [ ] Opportunity model + validation
- [ ] Application model + `ref`
- [ ] Verified insert/reject in Atlas

**Phase 3 — APIs**
- [ ] Opportunity CRUD (5 endpoints)
- [ ] Search + domain filter
- [ ] Application create + list
- [ ] Error handler + 404 middleware
- [ ] All endpoints pass in Postman

**Phase 4 — Frontend Foundation**
- [ ] React app scaffolded (Vite)
- [ ] Router + route table
- [ ] MainLayout (navbar/footer)
- [ ] Axios instance with env baseURL

**Phase 5 — Listing**
- [ ] Fetch + render cards
- [ ] Loading / error / empty states

**Phase 6 — Details**
- [ ] Fetch by id via useParams
- [ ] Not-found handled
- [ ] Apply button routes

**Phase 7 — Search & Filter**
- [ ] SearchBar + FilterDropdown
- [ ] State lifted to HomePage
- [ ] Query params → backend
- [ ] Debounced search

**Phase 8 — Apply + Confirmation**
- [ ] Controlled form + validation
- [ ] POST application
- [ ] Confirmation page
- [ ] Double-submit prevented

**Phase 9 — Admin**
- [ ] Dashboard table
- [ ] Add (reused form)
- [ ] Edit (pre-filled)
- [ ] Delete (with confirm)
- [ ] View applications

**Phase 10 — Polish**
- [ ] Three-state rule everywhere
- [ ] No console errors
- [ ] Responsive
- [ ] Debug code removed

**Phase 11 — Testing**
- [ ] Full manual regression passed
- [ ] (Bonus) Automated tests

**Phase 12 — Deployment**
- [ ] DB, backend, frontend live
- [ ] Env vars + CORS correct
- [ ] Live app fully works

**Phase 13 — (Optional) Auth**
- [ ] JWT login + protected routes

---

## ⏱️ Time Estimates & Optimal Order

| Phase | Estimate |
|---|---|
| 0 — Planning | 2–4 hours |
| 1 — Backend foundation | 2–3 hours |
| 2 — Models | 1–2 hours |
| 3 — CRUD + query APIs | 5–7 hours |
| 4 — Frontend foundation | 3–4 hours |
| 5 — Listing | 3–4 hours |
| 6 — Details | 2–3 hours |
| 7 — Search & filter | 3–4 hours |
| 8 — Apply + confirmation | 4–5 hours |
| 9 — Admin dashboard | 6–8 hours |
| 10 — Polish | 3–5 hours |
| 11 — Testing | 3–5 hours |
| 12 — Deployment | 2–4 hours |
| 13 — Auth (optional) | 5–7 hours |
| **Total (core)** | **~40–55 hours** (~2–3 focused weeks part-time) |

### Golden rules for order
1. **Build the backend completely first (Phases 1–3) and prove it in Postman.** Don't touch React until the API is solid.
2. **Follow the user's real journey:** Listing → Details → Search → Apply.
3. **Build Admin (Phase 9) after the user side** — reuse the patterns you've learned.
4. **Deploy early-ish** if nervous (a "hello world" deploy after Phase 4) to catch deployment issues early.
5. **Commit after every milestone.** Never let uncommitted work pile up.

### Debugging mindset
When stuck, follow the data: **Network tab** (what did the browser send?) → **backend logs** (what did it receive?) → **DB** (what got saved?).
