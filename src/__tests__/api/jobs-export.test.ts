import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { jobPosting: { findMany: mockFindMany } },
}))

import { GET } from '@/app/api/jobs/export/route'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest
}

const BASE_DATE = new Date('2025-01-15T12:00:00Z')

const JOB_1 = {
  id: 'job-1',
  company: 'Acme Corp',
  role: 'Product Manager',
  category: 'Product Manager',
  level: 'Senior',
  modality: 'Remote',
  location: 'NYC',
  salary: '$120k',
  skills: ['Agile', 'SQL'],
  softSkills: ['Leadership'],
  status: 'Not Applied',
  postedAt: BASE_DATE,
  addedAt: BASE_DATE,
  rawText: 'raw text',
  url: null,
  notes: null,
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('GET /api/jobs/export', () => {
  beforeEach(() => mockFindMany.mockReset())

  it('returns a CSV response with correct content-type', async () => {
    mockFindMany.mockResolvedValue([JOB_1])
    const res = await GET(makeRequest('http://localhost/api/jobs/export'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
  })

  it('returns the default filename when no category is specified', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await GET(makeRequest('http://localhost/api/jobs/export'))
    expect(res.headers.get('Content-Disposition')).toContain('workaid_jobs.csv')
  })

  it('includes category in filename when filter is applied', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await GET(makeRequest('http://localhost/api/jobs/export?category=Product+Manager'))
    expect(res.headers.get('Content-Disposition')).toContain('workaid_Product_Manager.csv')
  })

  it('includes all expected column headers', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await GET(makeRequest('http://localhost/api/jobs/export'))
    const text = await res.text()
    expect(text).toContain('Company')
    expect(text).toContain('Role')
    expect(text).toContain('Category')
    expect(text).toContain('Skills')
    expect(text).toContain('Posted At')
    expect(text).toContain('Added At')
  })

  it('includes job data in the CSV body', async () => {
    mockFindMany.mockResolvedValue([JOB_1])
    const res = await GET(makeRequest('http://localhost/api/jobs/export'))
    const text = await res.text()
    expect(text).toContain('Acme Corp')
    expect(text).toContain('Product Manager')
    expect(text).toContain('Agile; SQL')
  })

  it('joins multiple skills with semicolons', async () => {
    mockFindMany.mockResolvedValue([{ ...JOB_1, skills: ['Python', 'SQL', 'Docker'] }])
    const res = await GET(makeRequest('http://localhost/api/jobs/export'))
    const text = await res.text()
    expect(text).toContain('Python; SQL; Docker')
  })

  it('escapes double-quotes inside cell values', async () => {
    mockFindMany.mockResolvedValue([{ ...JOB_1, role: 'Senior "PM" Role' }])
    const res = await GET(makeRequest('http://localhost/api/jobs/export'))
    const text = await res.text()
    expect(text).toContain('""PM""')
  })

  it('wraps each cell in double quotes', async () => {
    mockFindMany.mockResolvedValue([JOB_1])
    const res = await GET(makeRequest('http://localhost/api/jobs/export'))
    const text = await res.text()
    expect(text).toContain('"Acme Corp"')
    expect(text).toContain('"Product Manager"')
  })

  it('filters by category when query param is present', async () => {
    mockFindMany.mockResolvedValue([JOB_1])
    await GET(makeRequest('http://localhost/api/jobs/export?category=Design'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: 'Design' } })
    )
  })

  it('returns only the header row when no jobs match', async () => {
    mockFindMany.mockResolvedValue([])
    const res = await GET(makeRequest('http://localhost/api/jobs/export'))
    const text = await res.text()
    const lines = text.trim().split('\n')
    expect(lines).toHaveLength(1)
  })
})
