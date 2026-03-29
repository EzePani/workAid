import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function optimizeCV(cvText: string, jobDescription: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert CV writer and ATS optimization specialist.

Your task is to rewrite the provided CV to perfectly match the job description, following these strict rules:

RULES:
1. NEVER invent, fabricate, or exaggerate any experience, skill, or achievement
2. Only use information present in the original CV
3. Rewrite and reframe existing experience using keywords from the job description
4. Follow Harvard CV format strictly
5. Output must fit ONE PAGE (max ~600 words of content)
6. No photo, no personal photo, no profile picture references
7. Use strong ATS-friendly keywords from the job description naturally
8. Use clean, simple formatting — no tables, no columns, no graphics
9. Quantify achievements where they already exist in the original CV
10. Start with a concise 2-3 line professional summary tailored to this role

FORMAT (follow this exact structure):
---
EZEQUIEL PANIGAZZI
[City, Country] | [email] | [phone] | [LinkedIn if present]

PROFESSIONAL SUMMARY
[2-3 lines tailored to this specific role]

EXPERIENCE
[Job Title] | [Company] | [Dates]
• [Achievement bullet using job description keywords]
• [Achievement bullet]

EDUCATION
[Degree] | [Institution] | [Year]

SKILLS
[Comma-separated list of relevant skills from both CV and job description]
---

ORIGINAL CV:
${cvText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY the rewritten CV text, no explanations, no commentary.`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')
  return content.text
}

export async function parseJobPosting(rawText: string): Promise<{
  company: string | null
  role: string
  category: string
  skills: string[]
  level: string | null
  modality: string | null
  salary: string | null
  location: string | null
  postedAt: string | null
}> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Extract structured information from this job posting. Return ONLY valid JSON, no markdown, no explanation.

JSON schema:
{
  "company": "company name or null",
  "role": "job title (required)",
  "category": "general job category (e.g. 'Product Manager', 'Software Engineer', 'Data Scientist')",
  "skills": ["array", "of", "required", "skills"],
  "level": "Junior | Mid | Senior | Lead | null",
  "modality": "Remote | Hybrid | On-site | null",
  "salary": "salary range as string or null",
  "location": "city/country or null",
  "postedAt": "ISO date string if found or null"
}

JOB POSTING:
${rawText}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  const parsed = JSON.parse(content.text)
  return parsed
}
