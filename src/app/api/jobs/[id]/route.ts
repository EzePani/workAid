import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']
const EDITABLE_FIELDS = ['role', 'company', 'location', 'salary', 'url', 'level', 'modality', 'notes', 'category'] as const

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const job = await prisma.jobPosting.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(job)
  } catch (error) {
    console.error('Failed to fetch job:', error)
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const updateData: Record<string, unknown> = {}

    if ('status' in body) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updateData.status = body.status
    }

    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        updateData[field] = body[field] || null
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const job = await prisma.jobPosting.update({
      where: { id: params.id },
      data: updateData,
    })
    return NextResponse.json(job)
  } catch (error) {
    console.error('Failed to update job:', error)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.jobPosting.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete job:', error)
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
  }
}
