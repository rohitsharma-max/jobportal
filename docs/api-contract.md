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

## HTTP status codes we use
| Code | When |
|---|---|
| `200` | Successful GET / PUT / DELETE |
| `201` | Successful POST (resource created) |
| `400` | Bad request — missing fields OR invalid Mongo ObjectId |
| `404` | Resource not found (bad id, or unknown route) |
| `500` | Unexpected server error (should be rare) |

---

## Endpoints overview

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | any | Health check — returns JSON, proves server is up |
| GET | `/api/opportunities` | user | List all (supports `?search=` and `?domain=`) |
| GET | `/api/opportunities/:id` | user | Single opportunity |
| POST | `/api/opportunities` | admin | Create |
| PUT | `/api/opportunities/:id` | admin | Update |
| DELETE | `/api/opportunities/:id` | admin | Delete |
| POST | `/api/applications` | user | Submit an application |
| GET | `/api/applications` | admin | List all (supports `?opportunityId=`) |

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
- Body: any subset of fields to change
- Uses `findByIdAndUpdate(id, body, { new: true, runValidators: true })`
- Success → `200` with the **updated** object
- Invalid id → `400` · not found → `404`

### DELETE `/api/opportunities/:id`  (admin)
- Success → `200` with a confirmation message
- Invalid id → `400` · not found → `404`

---

## Application endpoints

### POST `/api/applications`  (user)
Request body:
```json
{
  "opportunityId": "665f...",
  "name": "Rohit Sharma",
  "email": "rohit@example.com",
  "phone": "9876543210",
  "resumeLink": "https://drive.google.com/...",
  "coverNote": "I'm excited to apply because..."
}
```
- Success → `201` with the created application
- Missing `opportunityId` / `name` / `email`, or invalid email → `400`

### GET `/api/applications`  (admin)
- Optional query param `?opportunityId=...` to filter to one opportunity
- Uses `.populate('opportunityId')` so each application includes the opportunity's title/company
- Response `200` with an array

---

## Error handling rules
- Wrap every async controller so thrown errors reach a central `errorHandler` middleware
- Invalid ObjectId → return `400`, never let it become a `500`
- Unknown routes → `notFound` middleware returns `404` in the same envelope
- Never trust client input — validate on the server even though the frontend also validates
