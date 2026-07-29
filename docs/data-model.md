# Data Model

> The database is the source of truth. Get these two schemas right and everything on top becomes easy.
> Stack: MongoDB with Mongoose.

We have **two collections**: `Opportunity` and `Application`.
An Application points to the Opportunity it was submitted for (a one-to-many relationship:
one opportunity can have many applications).

```
Opportunity  (1) ────────< (many)  Application
      _id  ◄───────────────  opportunityId (ref)
```

---

## 1. Opportunity

Represents a single internship or job posting. Created/edited/deleted by the admin.

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | String | ✅ | Job/internship title. `trim: true` |
| `company` | String | ✅ | Company name. `trim: true` |
| `domain` | String | ✅ | **The filter key.** Must be one of the fixed domain list below (enum) so filtering stays consistent |
| `type` | String | ✅ | `enum: ['Internship', 'Job']` |
| `location` | String | ❌ | e.g. "Remote", "Bangalore" |
| `experience` | String | ❌ | e.g. "Fresher", "0–1 years", "2+ years" |
| `description` | String | ✅ | Long text describing the role |
| `stipendOrSalary` | String | ❌ | Kept as String to allow "₹15,000/month", "Unpaid", "6 LPA", etc. |
| `applicationLink` | String (URL) | ❌ | Optional **external** apply link. The internal apply form is the primary path |
| `requirements` | [String] | ❌ | List of skills, e.g. `["React", "Node.js"]` |
| `createdAt` / `updatedAt` | Date | auto | From `{ timestamps: true }` |

### Fixed domain list (enum)
Using a fixed list (not free text) prevents casing bugs like `"web development"` vs `"Web Development"`
that would silently break the filter. The frontend filter dropdown reads from this same list.

```
Web Development
Mobile Development
Data Science
Machine Learning
UI/UX Design
DevOps
Cybersecurity
Marketing
Finance
Human Resources
Content Writing
```

### Validation summary
- `title`, `company`, `domain`, `type`, `description` → required
- `type` → must be `Internship` or `Job` (enum)
- `domain` → must be in the fixed list (enum)
- `trim: true` on string fields to avoid leading/trailing whitespace
- `timestamps: true`

---

## 2. Application

Represents one user's submission to an opportunity. Created by users, viewed by admin.

| Field | Type | Required | Notes |
|---|---|---|---|
| `opportunityId` | ObjectId | ✅ | `ref: 'Opportunity'` — links to the opportunity applied for. Enables `.populate()` |
| `name` | String | ✅ | Applicant's full name. `trim: true` |
| `email` | String | ✅ | Validated with a regex `match` |
| `phone` | String | ❌ | Optional |
| `resumeLink` | String (URL) | ❌ | **A URL (e.g. Google Drive), not a file upload** in v1. File upload is a v2/bonus feature |
| `coverNote` | String | ❌ | Optional short message |
| `createdAt` / `updatedAt` | Date | auto | From `{ timestamps: true }` |

### Validation summary
- `opportunityId`, `name`, `email` → required
- `email` → regex `match` (e.g. `/^\S+@\S+\.\S+$/`)
- `resumeLink` → optional, but if present should look like a URL
- `ref: 'Opportunity'` on `opportunityId` so the admin's "View Applications" page can show the opportunity title via `.populate('opportunityId')`
- `timestamps: true`

---

## Why resume is a URL, not a file (v1)
File uploads (Multer + cloud storage) add real complexity: storage config, size limits, security.
For a beginner v1 we store a **link** to the resume (Google Drive / Dropbox).
Real file upload is listed as a **bonus feature** and can be added in v2.

## Naming conventions (decided now, used everywhere)
- **Variables / fields:** `camelCase`
- **URLs / routes:** `kebab-case` and lowercase (e.g. `/api/opportunities`)
- **React components:** `PascalCase` (e.g. `OpportunityCard`)
- **API response shape:** always `{ success, data, message }`
