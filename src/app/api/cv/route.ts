import { NextRequest, NextResponse } from 'next/server'
import { optimizeCV, parseJobPosting } from '@/lib/claude'
import { generateCVPdf } from '@/lib/pdf'
import pdfParse from 'pdf-parse'

function toSlug(s: string) {
  return s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const cvFile = formData.get('cv') as File | null
    const jobDescription = formData.get('jobDescription') as string | null

    if (!cvFile || !jobDescription) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const cvBuffer = Buffer.from(await cvFile.arrayBuffer())
    const parsedPdf = await pdfParse(cvBuffer)
    const cvText = parsedPdf.text

    const [optimizedCV, extracted] = await Promise.all([
      optimizeCV(cvText, jobDescription),
      parseJobPosting(jobDescription),
    ])

    const pdfBytes = await generateCVPdf(optimizedCV, 'Ezequiel Panigazzi')

    const role    = toSlug(extracted.role ?? 'Position')
    const company = toSlug(extracted.company ?? 'Company')
    const filename = `Ezequiel_Panigazzi_${company}_${role}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('CV optimization error:', error)
    return NextResponse.json({ error: 'Failed to optimize CV' }, { status: 500 })
  }
}
