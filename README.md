# WorkAid

**WorkAid** is a personal productivity tool for the modern job search. It combines two AI-powered features — a smart job tracker and an automated CV optimizer — so you can spend less time organizing and more time landing interviews.

---

## What it does

### Job Tracker
Paste any job posting as raw text and WorkAid uses Claude AI to automatically extract:
- Company, role, and category
- Required technical and soft skills
- Seniority level, work modality, location, and salary

Jobs are stored with a status you can update through the whole pipeline: **Not Applied → Applied → Interview → Offer → Rejected**. The tracker warns you if you try to add a position you've already saved, preventing duplicates.

Built-in filters let you slice your list by category, level, modality, and status in real-time. You can also free-text search across company, role, and location — no page reload needed.

When you're done, export everything to CSV with one click.

### CV Optimizer
Upload your CV as a PDF and paste a job description. WorkAid extracts the CV text, feeds both to Claude AI, and returns a tailored CV as a downloadable PDF — formatted in a clean Harvard-style layout, ready to submit.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL + Prisma ORM |
| AI | Claude API (via Anthropic SDK) |
| PDF generation | PDFKit |
| PDF parsing | pdf-parse |
| Testing | Vitest |

---

## Getting started

### Prerequisites
- Node.js 18+
- PostgreSQL database

### 1. Clone and install

```bash
git clone <repo-url>
cd workaid
npm install
```

### 2. Configure environment variables

Create a `.env` file at the project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/workaid"
ANTHROPIC_API_KEY="sk-ant-..."
```

### 3. Run database migrations

```bash
npx prisma migrate dev
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Running tests

```bash
# Run all tests once
npm run test:run

# Watch mode
npm test

# Coverage report
npm run test:coverage
```

52 unit tests cover all API routes and the AI parsing/optimization layer.

---

## Project structure

```
src/
  app/
    api/
      cv/route.ts          # POST: CV optimization endpoint
      jobs/route.ts         # GET + POST: list and create jobs
      jobs/[id]/route.ts    # GET + PATCH + DELETE: single job
      jobs/export/route.ts  # GET: export all jobs as CSV
    cv-optimizer/           # CV Optimizer page
    job-tracker/            # Job Tracker page
  lib/
    claude.ts               # AI functions (parseJobPosting, optimizeCV)
    pdf.ts                  # PDF generation (Harvard layout)
    prisma.ts               # Prisma client singleton
  __tests__/
    api/                    # API route unit tests
    lib/                    # Library unit tests
prisma/
  schema.prisma             # Database schema
  migrations/               # Migration history
```

---

## API reference

See [docs/API.md](docs/API.md) for full endpoint documentation including request/response shapes, error codes, and example payloads.
