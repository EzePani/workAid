import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockOptimizeCV, mockParseJobPosting, mockAnalyzeCV, mockGeneratePdf, mockPdfParse } =
  vi.hoisted(() => ({
    mockOptimizeCV:      vi.fn(),
    mockParseJobPosting: vi.fn(),
    mockAnalyzeCV:       vi.fn(),
    mockGeneratePdf:     vi.fn(),
    mockPdfParse:        vi.fn(),
  }))

vi.mock('@/lib/claude', () => ({
  optimizeCV:      mockOptimizeCV,
  parseJobPosting: mockParseJobPosting,
  analyzeCV:       mockAnalyzeCV,
}))
vi.mock('@/lib/pdf',    () => ({ generateCVPdf: mockGeneratePdf }))
vi.mock('pdf-parse',    () => ({ default: mockPdfParse }))

import { POST }            from '@/app/api/cv/route'
import { POST as ANALYZE } from '@/app/api/cv/analyze/route'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeMockRequest(fields: {
  cv?:            { arrayBuffer: () => Promise<ArrayBuffer> } | null
  jobDescription?: string | null
  analysis?:      string | null
}): NextRequest {
  return {
    formData: async () => ({
      get: (key: string) => (fields as Record<string, unknown>)[key] ?? null,
    }),
  } as unknown as NextRequest
}

const MOCK_CV_FILE = { arrayBuffer: async () => new ArrayBuffer(8) }

const FULL_FIELDS = {
  cv:             MOCK_CV_FILE,
  jobDescription: 'We are looking for a Senior Product Manager...',
}

// ── POST /api/cv ──────────────────────────────────────────────────────────────
describe('POST /api/cv', () => {
  beforeEach(() => {
    mockPdfParse.mockReset()
    mockOptimizeCV.mockReset()
    mockParseJobPosting.mockReset()
    mockGeneratePdf.mockReset()

    mockPdfParse.mockResolvedValue({ text: 'Extracted CV text from PDF' })
    mockOptimizeCV.mockResolvedValue('Optimized CV content here')
    mockParseJobPosting.mockResolvedValue({ role: 'Senior Product Manager', company: 'TechCorp' })
    mockGeneratePdf.mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
  })

  it('returns 400 when cv file is missing', async () => {
    const req = makeMockRequest({ cv: null, jobDescription: 'desc' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Missing required fields')
  })

  it('returns 400 when jobDescription is missing', async () => {
    const req = makeMockRequest({ cv: MOCK_CV_FILE, jobDescription: null })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns a PDF response with correct content-type on success', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('sets filename from parsed job data: Ezequiel_Panigazzi_Company_Role.pdf', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    const res = await POST(req)
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toContain('Ezequiel_Panigazzi_TechCorp_Senior_Product_Manager.pdf')
  })

  it('slugifies spaces to underscores in filename', async () => {
    mockParseJobPosting.mockResolvedValue({ role: 'Lead Data Scientist', company: 'My Big Company' })
    const req = makeMockRequest(FULL_FIELDS)
    const res = await POST(req)
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toContain('My_Big_Company')
    expect(disposition).toContain('Lead_Data_Scientist')
  })

  it('calls optimizeCV with CV text, job description and undefined analysis by default', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    await POST(req)
    expect(mockOptimizeCV).toHaveBeenCalledWith(
      'Extracted CV text from PDF',
      'We are looking for a Senior Product Manager...',
      undefined,
    )
  })

  it('passes parsed analysis object to optimizeCV when provided', async () => {
    const analysis = { missingSkills: ['SQL'], suggestions: ['Add SQL experience'] }
    const req = makeMockRequest({ ...FULL_FIELDS, analysis: JSON.stringify(analysis) })
    await POST(req)
    expect(mockOptimizeCV).toHaveBeenCalledWith(
      'Extracted CV text from PDF',
      'We are looking for a Senior Product Manager...',
      analysis,
    )
  })

  it('calls generateCVPdf with the optimized CV text', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    await POST(req)
    expect(mockGeneratePdf).toHaveBeenCalledWith('Optimized CV content here')
  })

  it('returns 500 when optimizeCV throws', async () => {
    mockOptimizeCV.mockRejectedValue(new Error('LLM error'))
    const req = makeMockRequest(FULL_FIELDS)
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})

// ── POST /api/cv/analyze ──────────────────────────────────────────────────────
describe('POST /api/cv/analyze', () => {
  beforeEach(() => {
    mockPdfParse.mockReset()
    mockAnalyzeCV.mockReset()

    mockPdfParse.mockResolvedValue({ text: 'Extracted CV text from PDF' })
    mockAnalyzeCV.mockResolvedValue({
      overallFit:     'medium',
      matchingSkills: ['TypeScript', 'React'],
      missingSkills:  ['SQL'],
      suggestions:    ['Add SQL experience if you have any'],
    })
  })

  it('returns 400 when cv is missing', async () => {
    const req = makeMockRequest({ cv: null, jobDescription: 'desc' })
    const res = await ANALYZE(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when jobDescription is missing', async () => {
    const req = makeMockRequest({ cv: MOCK_CV_FILE, jobDescription: null })
    const res = await ANALYZE(req)
    expect(res.status).toBe(400)
  })

  it('returns analysis JSON with overallFit on success', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    const res = await ANALYZE(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.overallFit).toBe('medium')
    expect(body.matchingSkills).toContain('TypeScript')
    expect(body.missingSkills).toContain('SQL')
    expect(body.suggestions).toHaveLength(1)
  })

  it('calls analyzeCV with extracted CV text and job description', async () => {
    const req = makeMockRequest(FULL_FIELDS)
    await ANALYZE(req)
    expect(mockAnalyzeCV).toHaveBeenCalledWith(
      'Extracted CV text from PDF',
      'We are looking for a Senior Product Manager...',
    )
  })

  it('returns 500 when analyzeCV throws', async () => {
    mockAnalyzeCV.mockRejectedValue(new Error('LLM error'))
    const req = makeMockRequest(FULL_FIELDS)
    const res = await ANALYZE(req)
    expect(res.status).toBe(500)
  })
})
