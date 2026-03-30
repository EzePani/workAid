import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function optimizeCV(
  cvText: string,
  jobDescription: string,
  analysis?: { missingSkills: string[]; suggestions: string[] },
): Promise<string> {
  const gapContext = analysis?.missingSkills.length
    ? `
GAP ANALYSIS (use this to prioritize reframing):
- Skills the job requires that are not explicit in the CV: ${analysis.missingSkills.join(', ')}
- Key recommendations to address: ${analysis.suggestions.join(' | ')}
If any of these gaps can be addressed by reframing existing experience, do so. Never invent experience.
`
    : ''

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert CV writer and ATS optimization specialist.

Your task is to rewrite the provided CV to perfectly match the job description.

STRICT RULES — violating any of these is unacceptable:
1. NEVER invent, fabricate, or exaggerate any experience, skill, achievement, or date
2. NEVER add a section that does not exist in the original CV (e.g. if there is no Education section, do not include one)
3. Only use information present in the original CV — reframe and reword, never invent
4. Use ATS-friendly keywords from the job description naturally within existing experience
5. Output must fit ONE PAGE (max ~550 words of body content)
6. No photos, no references, no "References available upon request"
7. Quantify achievements only if numbers already exist in the original CV
${gapContext}
OUTPUT FORMAT — follow this structure exactly, using these exact markers:

[FULL NAME IN CAPS]
[City, Country]
[LinkedIn] | [GitHub] | [email]

PROFILE
[2–3 sentence summary tailored to this role, using keywords from job description]

PROFESSIONAL EXPERIENCE
[TITLE] Job Title | Location
[META] Company – Product or Team | Start Year – End Year
• Achievement bullet rewritten with job description keywords
• Achievement bullet

[TITLE] Job Title | Location
[META] Company | Start Year – End Year
• Achievement bullet
• Achievement bullet

SKILLS
[Category]:: skill1, skill2, skill3
[Category]:: skill1, skill2

LANGUAGES
Language1 (Level) · Language2 (Level)

MARKER RULES:
- Use [TITLE] prefix for the job title line (bold, with location on the right separated by |)
- Use [META] prefix for the company/dates line (italic, with dates on the right separated by |)
- Bullets start with •
- Skills use Category:: format (e.g. "Engineering:: JavaScript, TypeScript, React")
- Only include sections present in the original CV
- Do NOT include EDUCATION unless the original CV has an Education section
- Do NOT include section separators like ---

ORIGINAL CV:
${cvText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY the formatted CV text. No explanations, no comments, no markdown.`,
      },
    ],
  })

  return completion.choices[0].message.content ?? ''
}

export async function analyzeCV(cvText: string, jobDescription: string): Promise<{
  overallFit: 'high' | 'medium' | 'low'
  matchingSkills: string[]
  missingSkills: string[]
  suggestions: string[]
}> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a career coach analyzing how well a CV matches a job description. Return ONLY valid JSON, no markdown, no explanation.

Analyze the CV against the job description and identify:
1. Skills/requirements the job asks for that are clearly present in the CV
2. Skills/requirements the job asks for that are missing or not evident in the CV
3. Specific, actionable suggestions to improve the CV for this role
4. Overall fit level

Rules:
- Write all skill names in English
- Be specific and honest — if SQL is required but not in the CV, flag it
- Suggestions should be concrete (e.g. "Add SQL experience if you have any" not "improve technical skills")
- Max 8 items per list
- overallFit: "high" if 70%+ requirements match, "medium" if 40-70%, "low" if below 40%

JSON schema:
{
  "overallFit": "high" | "medium" | "low",
  "matchingSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3", "skill4"],
  "suggestions": ["Specific suggestion 1", "Specific suggestion 2"]
}

CV:
${cvText}

JOB DESCRIPTION:
${jobDescription}`,
      },
    ],
  })

  const text = completion.choices[0].message.content ?? '{}'
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(cleaned)

  return {
    overallFit: parsed.overallFit ?? 'medium',
    matchingSkills: parsed.matchingSkills ?? [],
    missingSkills: parsed.missingSkills ?? [],
    suggestions: parsed.suggestions ?? [],
  }
}

export async function parseJobPosting(rawText: string): Promise<{
  company: string | null
  role: string
  category: string
  skills: string[]
  softSkills: string[]
  level: string | null
  modality: string | null
  salary: string | null
  location: string | null
  postedAt: string | null
}> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Extract structured information from this job posting. Return ONLY valid JSON, no markdown, no explanation.

IMPORTANT RULES for skills extraction:
- Always write skill names in ENGLISH regardless of the job posting language
- Normalize synonyms into one canonical term (e.g. "Gestión de producto" → "Product Management", "SQL / MySQL / PostgreSQL" → "SQL", "Scrum / Agile / SAFe" → "Agile")
- Be broad, not granular — group related tools under one concept when appropriate
- "hardSkills": technical tools, technologies, domain knowledge, methodologies (e.g. SQL, Python, Agile, Product Roadmap, Data Analysis, A/B Testing, Figma)
- "softSkills": interpersonal and behavioral skills (e.g. Leadership, Communication, Stakeholder Management, Problem Solving, Teamwork)
- Max 10 items per category, only the most relevant ones
- Do NOT include the job title or seniority level as a skill

JSON schema:
{
  "company": "company name or null",
  "role": "job title in English",
  "category": "broad job category in English (e.g. 'Product Manager', 'Software Engineer', 'Data Scientist')",
  "hardSkills": ["Technical skill 1", "Technical skill 2"],
  "softSkills": ["Soft skill 1", "Soft skill 2"],
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

  const text = completion.choices[0].message.content ?? '{}'
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(cleaned)

  return {
    ...parsed,
    skills: parsed.hardSkills ?? parsed.skills ?? [],
    softSkills: parsed.softSkills ?? [],
  }
}
