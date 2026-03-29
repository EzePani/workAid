import { NextRequest, NextResponse } from 'next/server'
import { parseJobPosting } from '@/lib/claude'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { url, category } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    // Jina.ai Reader: converts any URL to clean text for free
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/plain' },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Could not fetch the URL. Make sure it is public.' }, { status: 422 })
    }

    const rawText = await res.text()

    if (rawText.length < 100) {
      return NextResponse.json({ error: 'Page content too short. The URL may require login.' }, { status: 422 })
    }

    const extracted = await parseJobPosting(rawText)

    const job = await prisma.jobPosting.create({
      data: {
        rawText,
        url,
        company: extracted.company,
        role: extracted.role,
        category: category || extracted.category,
        skills: extracted.skills,
        level: extracted.level,
        modality: extracted.modality,
        salary: extracted.salary,
        location: extracted.location,
        postedAt: extracted.postedAt ? new Date(extracted.postedAt) : null,
      },
    })

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json({ error: 'Failed to import from URL' }, { status: 500 })
  }
}
