import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockFindUnique, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate:     vi.fn(),
  mockDelete:     vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobPosting: {
      findUnique: mockFindUnique,
      update:     mockUpdate,
      delete:     mockDelete,
    },
  },
}))

import { GET, PATCH, DELETE } from '@/app/api/jobs/[id]/route'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest
}

const PARAMS = { params: { id: 'job-abc' } }

const BASE_JOB = {
  id: 'job-abc',
  rawText: 'Original job description',
  company: 'Acme Corp',
  role: 'Product Manager',
  category: 'Product Manager',
  skills: ['Agile', 'SQL'],
  softSkills: ['Leadership'],
  level: 'Senior',
  modality: 'Remote',
  salary: '$120k',
  location: 'NYC',
  url: null,
  notes: null,
  status: 'Not Applied',
  postedAt: null,
  addedAt: new Date(),
}

// ── GET /api/jobs/[id] ────────────────────────────────────────────────────────
describe('GET /api/jobs/[id]', () => {
  beforeEach(() => mockFindUnique.mockReset())

  it('returns the job when found', async () => {
    mockFindUnique.mockResolvedValue(BASE_JOB)
    const res = await GET(makeRequest('http://localhost/api/jobs/job-abc'), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('job-abc')
    expect(body.role).toBe('Product Manager')
  })

  it('queries by the correct job id', async () => {
    mockFindUnique.mockResolvedValue(BASE_JOB)
    await GET(makeRequest('http://localhost/api/jobs/job-abc'), PARAMS)
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'job-abc' } })
  })

  it('returns 404 when job does not exist', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(makeRequest('http://localhost/api/jobs/job-abc'), PARAMS)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })
})

// ── PATCH /api/jobs/[id] ──────────────────────────────────────────────────────
describe('PATCH /api/jobs/[id]', () => {
  beforeEach(() => mockUpdate.mockReset())

  it('updates status when a valid status is provided', async () => {
    mockUpdate.mockResolvedValue({ ...BASE_JOB, status: 'Applied' })
    const req = makeRequest('http://localhost/api/jobs/job-abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Applied' }),
    })
    const res = await PATCH(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('Applied')
  })

  it('returns 400 for an invalid status value', async () => {
    const req = makeRequest('http://localhost/api/jobs/job-abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'WrongStatus' }),
    })
    const res = await PATCH(req, PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid status')
  })

  it('accepts all five valid status values', async () => {
    const validStatuses = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']
    for (const status of validStatuses) {
      mockUpdate.mockResolvedValue({ ...BASE_JOB, status })
      const req = makeRequest('http://localhost/api/jobs/job-abc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const res = await PATCH(req, PARAMS)
      expect(res.status).toBe(200)
    }
  })

  it('updates editable fields like role and company', async () => {
    mockUpdate.mockResolvedValue({ ...BASE_JOB, role: 'Lead PM', company: 'NewCo' })
    const req = makeRequest('http://localhost/api/jobs/job-abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Lead PM', company: 'NewCo' }),
    })
    const res = await PATCH(req, PARAMS)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'Lead PM', company: 'NewCo' }),
      })
    )
  })

  it('converts empty strings to null for optional fields', async () => {
    mockUpdate.mockResolvedValue({ ...BASE_JOB, salary: null })
    const req = makeRequest('http://localhost/api/jobs/job-abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salary: '' }),
    })
    await PATCH(req, PARAMS)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ salary: null }),
      })
    )
  })

  it('returns 400 when no valid fields are provided', async () => {
    const req = makeRequest('http://localhost/api/jobs/job-abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknownField: 'value' }),
    })
    const res = await PATCH(req, PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No valid fields to update')
  })
})

// ── DELETE /api/jobs/[id] ─────────────────────────────────────────────────────
describe('DELETE /api/jobs/[id]', () => {
  beforeEach(() => mockDelete.mockReset())

  it('deletes the job and returns success', async () => {
    mockDelete.mockResolvedValue(BASE_JOB)
    const res = await DELETE(makeRequest('http://localhost/api/jobs/job-abc'), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('calls delete with the correct job id', async () => {
    mockDelete.mockResolvedValue(BASE_JOB)
    await DELETE(makeRequest('http://localhost/api/jobs/job-abc'), PARAMS)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'job-abc' } })
  })
})
