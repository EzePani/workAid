import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (must be declared before vi.mock calls) ─────────────────────
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

import { parseJobPosting, optimizeCV, analyzeCV } from '@/lib/claude'

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

  it('includes gap analysis context in the prompt when analysis is provided', async () => {
    mockCreate.mockResolvedValue(groqResponse('optimized cv'))
    const analysis = { missingSkills: ['SQL', 'Python'], suggestions: ['Add SQL experience'] }
    await optimizeCV('CV text', 'Job desc', analysis)
    const prompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(prompt).toContain('SQL')
    expect(prompt).toContain('Python')
    expect(prompt).toContain('Add SQL experience')
  })

  it('does not include gap context section when analysis is not provided', async () => {
    mockCreate.mockResolvedValue(groqResponse('optimized cv'))
    await optimizeCV('CV text', 'Job desc')
    const prompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(prompt).not.toContain('GAP ANALYSIS')
  })
})

// ── analyzeCV ────────────────────────────────────────────────────────────────
describe('analyzeCV', () => {
  beforeEach(() => mockCreate.mockReset())

  const VALID_ANALYSIS = {
    overallFit:     'medium',
    matchingSkills: ['TypeScript', 'React', 'Agile'],
    missingSkills:  ['SQL', 'Python'],
    suggestions:    ['Add SQL experience', 'Highlight data analysis work'],
  }

  it('returns structured analysis from a valid Groq response', async () => {
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(VALID_ANALYSIS)))
    const result = await analyzeCV('My CV text', 'Job description requiring SQL')
    expect(result.overallFit).toBe('medium')
    expect(result.matchingSkills).toContain('TypeScript')
    expect(result.missingSkills).toContain('SQL')
    expect(result.suggestions).toHaveLength(2)
  })

  it('strips markdown code fences from the response', async () => {
    const wrapped = '```json\n' + JSON.stringify(VALID_ANALYSIS) + '\n```'
    mockCreate.mockResolvedValue(groqResponse(wrapped))
    const result = await analyzeCV('CV text', 'Job desc')
    expect(result.overallFit).toBe('medium')
  })

  it('falls back to "medium" overallFit when missing from response', async () => {
    const noFit = { ...VALID_ANALYSIS, overallFit: undefined }
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(noFit)))
    const result = await analyzeCV('CV text', 'Job desc')
    expect(result.overallFit).toBe('medium')
  })

  it('falls back to empty arrays when skill lists are missing', async () => {
    const empty = { overallFit: 'low', matchingSkills: undefined, missingSkills: undefined, suggestions: undefined }
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(empty)))
    const result = await analyzeCV('CV text', 'Job desc')
    expect(result.matchingSkills).toEqual([])
    expect(result.missingSkills).toEqual([])
    expect(result.suggestions).toEqual([])
  })

  it('includes both CV text and job description in the prompt', async () => {
    mockCreate.mockResolvedValue(groqResponse(JSON.stringify(VALID_ANALYSIS)))
    await analyzeCV('My unique CV content', 'This specific job posting')
    const prompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(prompt).toContain('My unique CV content')
    expect(prompt).toContain('This specific job posting')
  })

  it('throws when Groq returns invalid JSON', async () => {
    mockCreate.mockResolvedValue(groqResponse('not valid json at all'))
    await expect(analyzeCV('CV text', 'Job desc')).rejects.toThrow()
  })
})
