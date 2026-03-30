import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseJobPosting } from '@/lib/claude'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const jobs = await prisma.jobPosting.findMany({
      where: category ? { category } : undefined,
      orderBy: { addedAt: 'desc' },
    })

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('Failed to fetch jobs:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json()

    if (!rawText) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 })
    }

    const extracted = await parseJobPosting(rawText)

    // Duplicate detection: same company + role (case-insensitive)
    if (extracted.company && extracted.role) {
      const existing = await prisma.jobPosting.findFirst({
        where: {
          company: { equals: extracted.company, mode: 'insensitive' },
          role: { equals: extracted.role, mode: 'insensitive' },
        },
        select: { id: true, role: true, company: true },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'duplicate', role: existing.role, company: existing.company },
          { status: 409 }
        )
      }
    }

    const job = await prisma.jobPosting.create({
      data: {
        rawText,
        company: extracted.company,
        role: extracted.role,
        category: extracted.category,
        skills: extracted.skills,
        softSkills: extracted.softSkills,
        level: extracted.level,
        modality: extracted.modality,
        salary: extracted.salary,
        location: extracted.location,
        postedAt: extracted.postedAt ? new Date(extracted.postedAt) : null,
      },
    })

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    console.error('Failed to save job:', error)
    return NextResponse.json({ error: 'Failed to save job posting' }, { status: 500 })
  }
}
