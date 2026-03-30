import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function optimizeCV(cvText: string, jobDescription: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
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
