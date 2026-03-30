import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockOptimizeCV, mockGeneratePdf, mockPdfParse } = vi.hoisted(() => ({
  mockOptimizeCV:  vi.fn(),
  mockGeneratePdf: vi.fn(),
  mockPdfParse:    vi.fn(),
}))

vi.mock('@/lib/claude', () => ({ optimizeCV: mockOptimizeCV }))
vi.mock('@/lib/pdf',    () => ({ generateCVPdf: mockGeneratePdf }))
vi.mock('pdf-parse',    () => ({ default: mockPdfParse }))

import { POST } from '@/app/api/cv/route'

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Build a mock NextRequest that returns controlled formData fields.
 * This avoids needing File/FormData globals in the Node test environment.
 */
function makeMockRequest(fields: {
  cv?: { arrayBuffer: () => Promise<ArrayBuffer> } | null
  jobDescription?: string | null
  jobTitle?: string | null
  company?: string | null
}): NextRequest {
  return {
    formData: async () => ({
      get: (key: string) => {
        if (key in fields) return (fields as Record<string, unknown>)[key] ?? null
        return null
      },
    }),
  } as unknown as NextRequest
}

const MOCK_CV_FILE = {
  arrayBuffer: async () => new ArrayBuffer(8),
}

const FULL_FIELDS = {
  cv: MOCK_CV_FILE,
  jobDescription: 'We are looking for a Senior Product Manager...',
  jobTitle: 'Senior Product Manager',
  company: 'TechCorp',
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/cv', () => {
  beforeEach(() => {
    mockPdfParse.mockReset()
    mockOptimizeCV.mockReset()
    mockGeneratePdf.mockReset()

    mockPdfParse.mockResolvedValue({ text: 'Extracted CV text from PDF' })
    mockOptimizeCV.mockResolvedValue('Optimized CV content here')
    mockGeneratePdf.mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
  })

  it('returns 400 when cv file is missing', async () => {
    const req = makeMockRequest({ cv: null, jobDescription: 'desc', jobTitle: 'Engineer', company: 'Acme' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Missing required fields')
  })

  it('returns 400 when jobDescription is missing', async () => {
    const req = makeMockRequest({ cv: MOCK_CV_FILE, jobDescription: null, jobTitle: 'Engineer', company: 'Acme' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when jobTitle is missing', async () => {
    const req = makeMockRequest({ cv: MOCK_CV_FILE, jobDescription: 'desc', jobTitle: null, company: 'Acme' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when company is missing', async () => {
    const req = makeMockRequest({ cv: MOCK_CV_FILE, jobDescription: 'desc', jobTitle: 'Engineer', company: null })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns a PDF response with correct content-type on success', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('sets the correct Content-Disposition filename', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    const res = await POST(req)
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toContain('CV_EzequielPanigazzi_TechCorp_Senior_Product_Manager.pdf')
  })

  it('replaces spaces with underscores in the filename', async () => {
    const req = makeMockRequest({
      ...FULL_FIELDS,
      company: 'My Big Company',
      jobTitle: 'Lead Data Scientist',
    })
    const res = await POST(req)
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toContain('My_Big_Company')
    expect(disposition).toContain('Lead_Data_Scientist')
  })

  it('calls optimizeCV with extracted PDF text and job description', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    await POST(req)
    expect(mockOptimizeCV).toHaveBeenCalledWith(
      'Extracted CV text from PDF',
      'We are looking for a Senior Product Manager...'
    )
  })

  it('calls generateCVPdf with the optimized CV text and candidate name', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    await POST(req)
    expect(mockGeneratePdf).toHaveBeenCalledWith(
      'Optimized CV content here',
      'Ezequiel Panigazzi'
    )
  })
})
