import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (must be declared before vi.mock calls) ─────────────────────
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

import { parseJobPosting, optimizeCV } from '@/lib/claude'

// ── Helpers ───────────────────────────────────────────────────────────────────
function groqResponse(content: string) {
  return { choices: [{ message: { content } }] }
}

const VALID_PARSED = {
  company: 'Acme Corp',
  role: 'Product Manager',
  category: 'Product Manager',
  hardSkills: ['Agile', 'SQL', 'Figma'],
  softSkills: ['Leadership', 'Communication'],
  level: 'Senior',
  modality: 'Remote',
  salary: '$120k - $150k',
  location: 'New York, USA',
  postedAt: '2025-01-15',
}

// ── parseJobPosting ───────────────────────────────────────────────────────────
describe('parseJobPosting', () => {
  beforeEach(() => mockCreate.mockReset())

  it('returns structured data from a valid Groq JSON response', async () => {
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(VALID_PARSED)))
    const result = await parseJobPosting('Senior PM role at Acme Corp...')

    expect(result.company).toBe('Acme Corp')
    expect(result.role).toBe('Product Manager')
    expect(result.category).toBe('Product Manager')
    expect(result.level).toBe('Senior')
    expect(result.modality).toBe('Remote')
    expect(result.salary).toBe('$120k - $150k')
    expect(result.location).toBe('New York, USA')
  })

  it('maps hardSkills to the skills field', async () => {
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(VALID_PARSED)))
    const result = await parseJobPosting('job text')
    expect(result.skills).toEqual(['Agile', 'SQL', 'Figma'])
  })

  it('maps softSkills correctly', async () => {
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(VALID_PARSED)))
    const result = await parseJobPosting('job text')
    expect(result.softSkills).toEqual(['Leadership', 'Communication'])
  })

  it('strips markdown code fences from the response', async () => {
    const wrapped = '```json\n' + JSON.stringify(VALID_PARSED) + '\n```'
    mockCreate.mockResolvedValue(groqResponse(wrapped))
    const result = await parseJobPosting('job text')
    expect(result.company).toBe('Acme Corp')
  })

  it('falls back to empty arrays when skills are absent', async () => {
    const withoutSkills = { ...VALID_PARSED, hardSkills: undefined, softSkills: undefined }
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(withoutSkills)))
    const result = await parseJobPosting('job text')
    expect(result.skills).toEqual([])
    expect(result.softSkills).toEqual([])
  })

  it('uses skills key directly if hardSkills key is absent', async () => {
    const withSkillsKey = { ...VALID_PARSED, hardSkills: undefined, skills: ['Python', 'Docker'] }
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(withSkillsKey)))
    const result = await parseJobPosting('job text')
    expect(result.skills).toEqual(['Python', 'Docker'])
  })

  it('includes the raw job text in the prompt sent to Groq', async () => {
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(VALID_PARSED)))
    const jobText = 'We are hiring a Senior PM at TechCorp...'
    await parseJobPosting(jobText)
    const callArg = mockCreate.mock.calls[0][0]
    expect(callArg.messages[0].content).toContain(jobText)
  })

  it('throws when Groq returns invalid JSON', async () => {
    mockCreate.mockResolvedValue(groqResponse('not valid json'))
    await expect(parseJobPosting('job text')).rejects.toThrow()
  })
})

// ── optimizeCV ────────────────────────────────────────────────────────────────
describe('optimizeCV', () => {
  beforeEach(() => mockCreate.mockReset())

  it('returns the AI-generated CV text', async () => {
    const optimized = 'JOHN DOE\nSoftware Engineer\n\nPROFESSIONAL SUMMARY\n...'
    mockCreate.mockResolvedValue(groqResponse(optimized))
    const result = await optimizeCV('My original CV text', 'We need a senior engineer...')
    expect(result).toBe(optimized)
  })

  it('returns empty string when Groq returns null content', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: null } }] })
    const result = await optimizeCV('CV text', 'Job description')
    expect(result).toBe('')
  })

  it('includes both CV text and job description in the prompt', async () => {
    mockCreate.mockResolvedValue(groqResponse('optimized cv'))
    const cvText = 'My amazing CV'
    const jobDesc = 'Looking for a senior engineer with 5+ years'
    await optimizeCV(cvText, jobDesc)
    const callArg = mockCreate.mock.calls[0][0]
    const prompt = callArg.messages[0].content
    expect(prompt).toContain(cvText)
    expect(prompt).toContain(jobDesc)
  })
})
