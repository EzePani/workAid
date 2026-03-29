import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const jobs = await prisma.jobPosting.findMany({
      where: category ? { category } : undefined,
      orderBy: { addedAt: 'desc' },
    })

    const headers = ['Company', 'Role', 'Category', 'Level', 'Modality', 'Location', 'Salary', 'Skills', 'Posted At', 'Added At']
    const rows = jobs.map(j => [
      j.company ?? '',
      j.role,
      j.category,
      j.level ?? '',
      j.modality ?? '',
      j.location ?? '',
      j.salary ?? '',
      j.skills.join('; '),
      j.postedAt ? new Date(j.postedAt).toLocaleDateString() : '',
      new Date(j.addedAt).toLocaleDateString(),
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const filename = category ? `workaid_${category.replace(/\s+/g, '_')}.csv` : 'workaid_jobs.csv'

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}
