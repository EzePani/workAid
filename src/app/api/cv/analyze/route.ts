import { NextRequest, NextResponse } from 'next/server'
import { analyzeCV } from '@/lib/claude'
import pdfParse from 'pdf-parse'

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

    const analysis = await analyzeCV(cvText, jobDescription)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('CV analysis error:', error)
    return NextResponse.json({ error: 'Failed to analyze CV' }, { status: 500 })
  }
}
