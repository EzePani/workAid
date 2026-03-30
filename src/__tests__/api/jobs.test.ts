import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockFindMany, mockFindFirst, mockCreate, mockParseJobPosting } = vi.hoisted(() => ({
  mockFindMany:         vi.fn(),
  mockFindFirst:        vi.fn(),
  mockCreate:           vi.fn(),
  mockParseJobPosting:  vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobPosting: {
      findMany:  mockFindMany,
      findFirst: mockFindFirst,
      create:    mockCreate,
    },
  },
}))

vi.mock('@/lib/claude', () => ({ parseJobPosting: mockParseJobPosting }))

import { GET, POST } from '@/app/api/jobs/route'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest
}

const BASE_JOB = {
  id: 'job-1',
  rawText: 'Full job description here',
  company: 'Acme Corp',
  role: 'Software Engineer',
  category: 'Software Engineer',
  skills: ['Python', 'SQL'],
  softSkills: ['Communication'],
  level: 'Senior',
  modality: 'Remote',
  salary: '$130k',
  location: 'NYC',
  url: null,
  notes: null,
  status: 'Not Applied',
  postedAt: null,
  addedAt: new Date(),
}

const PARSED_JOB = {
  company: 'Acme Corp',
  role: 'Software Engineer',
  category: 'Software Engineer',
  skills: ['Python', 'SQL'],
  softSkills: ['Communication'],
  level: 'Senior',
  modality: 'Remote',
  salary: '$130k',
  location: 'NYC',
  postedAt: null,
}

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
describe('GET /api/jobs', () => {
  beforeEach(() => mockFindMany.mockReset())

  it('returns all jobs when no category filter', async () => {
    mockFindMany.mockResolvedValue([BASE_JOB])
    const res = await GET(makeRequest('http://localhost/api/jobs'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].role).toBe('Software Engineer')
  })

  it('calls findMany without where clause when no category param', async () => {
    mockFindMany.mockResolvedValue([])
    await GET(makeRequest('http://localhost/api/jobs'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    )
  })

  it('filters by category when query param is present', async () => {
    mockFindMany.mockResolvedValue([BASE_JOB])
    await GET(makeRequest('http://localhost/api/jobs?category=Design'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: 'Design' } })
    )
  })

  it('returns empty array when no jobs found', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await GET(makeRequest('http://localhost/api/jobs'))
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('orders results by addedAt descending', async () => {
    mockFindMany.mockResolvedValue([BASE_JOB])
    await GET(makeRequest('http://localhost/api/jobs'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { addedAt: 'desc' } })
    )
  })
})

// ── POST /api/jobs ────────────────────────────────────────────────────────────
describe('POST /api/jobs', () => {
  beforeEach(() => {
    mockParseJobPosting.mockReset()
    mockFindFirst.mockReset()
    mockCreate.mockReset()
  })

  it('returns 400 when rawText is missing', async () => {
    const req = makeRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('rawText is required')
  })

  it('returns 409 when a duplicate job exists', async () => {
    mockParseJobPosting.mockResolvedValue(PARSED_JOB)
    mockFindFirst.mockResolvedValue({ id: 'existing', role: 'Software Engineer', company: 'Acme Corp' })

    const req = makeRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: 'full posting text' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('duplicate')
    expect(body.role).toBe('Software Engineer')
    expect(body.company).toBe('Acme Corp')
  })

  it('creates the job and returns 201 when no duplicate', async () => {
    mockParseJobPosting.mockResolvedValue(PARSED_JOB)
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ ...BASE_JOB, id: 'new-job' })

    const req = makeRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: 'full posting text' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('new-job')
  })

  it('calls parseJobPosting with the provided rawText', async () => {
    mockParseJobPosting.mockResolvedValue(PARSED_JOB)
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue(BASE_JOB)

    const rawText = 'Senior Engineer at TechCorp. Requirements: Python, 5+ years...'
    const req = makeRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
    })
    await POST(req)
    expect(mockParseJobPosting).toHaveBeenCalledWith(rawText)
  })

  it('skips duplicate check when company is null', async () => {
    mockParseJobPosting.mockResolvedValue({ ...PARSED_JOB, company: null })
    mockCreate.mockResolvedValue(BASE_JOB)

    const req = makeRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: 'job text' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('stores all extracted fields when creating a job', async () => {
    mockParseJobPosting.mockResolvedValue(PARSED_JOB)
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue(BASE_JOB)

    const req = makeRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: 'job posting text' }),
    })
    await POST(req)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company: 'Acme Corp',
          role: 'Software Engineer',
          category: 'Software Engineer',
          level: 'Senior',
          modality: 'Remote',
        }),
      })
    )
  })
})
