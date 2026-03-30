# API Reference

WorkAid exposes four groups of REST endpoints under `/api`. All endpoints return JSON unless otherwise noted.

---

## Job Postings

### `GET /api/jobs`

Returns all saved job postings, ordered by date added (newest first).

**Query parameters**

| Parameter | Type | Description |
|---|---|---|
| `category` | string (optional) | Filter results to a specific job category |

**Response `200`**

```json
[
  {
    "id": "clxyz123",
    "company": "Acme Corp",
    "role": "Senior Product Manager",
    "category": "Product Manager",
    "skills": ["Agile", "SQL", "Product Roadmap"],
    "softSkills": ["Leadership", "Stakeholder Management"],
    "level": "Senior",
    "modality": "Remote",
    "salary": "$130k",
    "location": "NYC",
    "url": null,
    "notes": null,
    "status": "Not Applied",
    "postedAt": null,
    "addedAt": "2025-01-15T12:00:00.000Z",
    "rawText": "..."
  }
]
```

---

### `POST /api/jobs`

Parses a raw job posting text with AI and saves it to the database. Detects duplicate entries (same company + role, case-insensitive) before inserting.

**Request body**

```json
{
  "rawText": "We are looking for a Senior Product Manager at Acme Corp..."
}
```

| Field | Required | Description |
|---|---|---|
| `rawText` | yes | The full job posting text to parse |

**Responses**

| Status | Body | Description |
|---|---|---|
| `201` | Job object | Job successfully created |
| `400` | `{ "error": "rawText is required" }` | Missing body field |
| `409` | `{ "error": "duplicate", "role": "...", "company": "..." }` | A job with the same company + role already exists |

**How AI parsing works**

The `rawText` is sent to Claude (via Groq, model `llama-3.3-70b-versatile`) with a structured prompt that extracts:
- Company name, role title, and broad category
- Technical skills (`hardSkills`) and soft skills
- Seniority level, work modality, salary, and location
- Posting date if present

Skills are normalized to English and deduplicated. The result is stored in the `JobPosting` table.

---

### `GET /api/jobs/:id`

Retrieves a single job posting by ID.

**Responses**

| Status | Body | Description |
|---|---|---|
| `200` | Job object | Job found |
| `404` | `{ "error": "Not found" }` | No job with that ID |

---

### `PATCH /api/jobs/:id`

Updates one or more fields on a job posting.

**Request body**

Any combination of the following fields:

```json
{
  "status": "Applied",
  "role": "Lead PM",
  "company": "NewCo",
  "location": "Berlin",
  "salary": "€90k",
  "url": "https://...",
  "level": "Lead",
  "modality": "Hybrid",
  "notes": "Great culture",
  "category": "Product Manager"
}
```

Valid values for `status`: `Not Applied` | `Applied` | `Interview` | `Offer` | `Rejected`

Passing an empty string (`""`) for any optional field sets it to `null` in the database.

**Responses**

| Status | Body | Description |
|---|---|---|
| `200` | Updated job object | Patch successful |
| `400` | `{ "error": "Invalid status" }` | Status value not in the allowed list |
| `400` | `{ "error": "No valid fields to update" }` | Body contained no recognized fields |

---

### `DELETE /api/jobs/:id`

Deletes a job posting permanently.

**Responses**

| Status | Body | Description |
|---|---|---|
| `200` | `{ "success": true }` | Deleted successfully |

---

### `GET /api/jobs/export`

Exports all saved job postings as a CSV file.

**Query parameters**

| Parameter | Type | Description |
|---|---|---|
| `category` | string (optional) | Export only jobs in this category |

**Response headers**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="workaid_jobs.csv"
```

When a category filter is applied the filename becomes `workaid_{Category_Name}.csv` (spaces replaced with underscores).

**CSV columns**

`Company`, `Role`, `Category`, `Level`, `Modality`, `Location`, `Salary`, `Skills`, `Posted At`, `Added At`

- All cells are wrapped in double quotes
- Internal double quotes are escaped as `""`
- Multiple skills are joined with `; `

---

## CV Optimizer

### `POST /api/cv`

Accepts a PDF CV and a job description, rewrites the CV to match the role, and returns a formatted PDF.

**Request**

`Content-Type: multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `cv` | File (PDF) | yes | The candidate's current CV |
| `jobDescription` | string | yes | Full text of the target job description |
| `jobTitle` | string | yes | Job title (used in the output filename) |
| `company` | string | yes | Company name (used in the output filename) |

**Response `200`**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="CV_EzequielPanigazzi_{Company}_{Job_Title}.pdf"
```

The response body is the generated PDF as binary.

**Error responses**

| Status | Body | Description |
|---|---|---|
| `400` | `{ "error": "Missing required fields" }` | One or more form fields absent |
| `500` | `{ "error": "Failed to optimize CV" }` | AI or PDF generation error |

**How it works**

1. The uploaded PDF is parsed with `pdf-parse` to extract plain text
2. The CV text and job description are sent to Claude with a strict prompt that rewrites the CV using only facts from the original, adding ATS-relevant keywords from the job description
3. The rewritten text is rendered into a Harvard-style single-page PDF using PDFKit
4. The PDF is streamed back to the client

---

## Database schema

```prisma
model JobPosting {
  id         String    @id @default(cuid())
  rawText    String
  company    String?
  role       String
  category   String
  skills     String[]
  softSkills String[]
  level      String?
  modality   String?
  salary     String?
  location   String?
  postedAt   DateTime?
  addedAt    DateTime  @default(now())
  url        String?
  notes      String?
  status     String    @default("Not Applied")

  @@map("job_postings")
}
```

---

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GROQ_API_KEY` | API key for Groq (used for AI parsing and CV optimization) |
