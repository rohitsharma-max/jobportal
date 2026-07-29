# UI Pages & Routes

> The full page inventory. Built with React + React Router. Every "smart" page fetches from
> the API; "dumb" components just display props.

## Route table

| Path | Page | Who | What it does |
|---|---|---|---|
| `/` | HomePage (listing) | user | Fetch & show all opportunities as cards; holds search + filter state |
| `/opportunities/:id` | OpportunityDetailsPage | user | Full details for one opportunity + "Apply" button |
| `/opportunities/:id/apply` | ApplyPage | user | Application form; POSTs to `/api/applications` |
| `/confirmation` | ConfirmationPage | user | "Application submitted" success screen |
| `/admin` | AdminDashboard | admin | Table of opportunities with Edit/Delete + "Add" button |
| `/admin/add` | AddOpportunity | admin | Create form → POST |
| `/admin/edit/:id` | EditOpportunity | admin | Pre-filled form → PUT |
| `/admin/applications` | ViewApplications | admin | Table of all submitted applications |

## Reusable components
| Component | Purpose |
|---|---|
| `Navbar` | Top navigation (Home, Admin) |
| `Footer` | Bottom bar |
| `OpportunityCard` | One opportunity summary card (title, company, domain, type, location) → links to details |
| `SearchBar` | Controlled search input; lifts the term up to HomePage |
| `FilterDropdown` | Domain dropdown (options = fixed domain list); lifts selection up |
| `Loader` | Spinner shown while fetching |
| `OpportunityForm` | **One** form reused by both Add and Edit (a prop decides the mode) — DRY |

## The "three states" rule (every page that fetches)
Every fetching page must handle all three:
1. **Loading** → show `<Loader/>`
2. **Error** → friendly message ("Something went wrong")
3. **Empty** → "No opportunities found"
...and only then the real data.

## State management
No Redux. Just `useState` + `useEffect` and passing props down.
Search and filter state live in `HomePage` and are passed to `SearchBar` / `FilterDropdown`
(lifting state up). Context is only added later **if** we add authentication (Phase 13 / bonus).

## Config
- One central Axios instance (`api/axios.js`) with `baseURL` from `VITE_API_URL`.
- Never hardcode `http://localhost:5000` in components.
