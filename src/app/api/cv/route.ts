import { NextRequest, NextResponse } from 'next/server'
import { optimizeCV } from '@/lib/claude'
import { generateCVPdf } from '@/lib/pdf'
import pdfParse from 'pdf-parse'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const cvFile = formData.get('cv') as File | null
    const jobDescription = formData.get('jobDescription') as string | null
    const jobTitle = formData.get('jobTitle') as string | null
    const company = formData.get('company') as string | null

    if (!cvFile || !jobDescription || !jobTitle || !company) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const cvBuffer = Buffer.from(await cvFile.arrayBuffer())
    const parsedPdf = await pdfParse(cvBuffer)
    const cvText = parsedPdf.text

    const optimizedCV = await optimizeCV(cvText, jobDescription)

    const pdfBytes = await generateCVPdf(optimizedCV, 'Ezequiel Panigazzi')

    const filename = `CV_EzequielPanigazzi_${company.replace(/\s+/g, '_')}_${jobTitle.replace(/\s+/g, '_')}.pdf`

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
