import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const MARGIN = 50
const PAGE_WIDTH = 595
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LINE_HEIGHT = 14

interface TextOptions {
  size?: number
  bold?: boolean
  color?: [number, number, number]
}

export async function generateCVPdf(cvText: string, candidateName: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([PAGE_WIDTH, 841]) // A4

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = 841 - MARGIN

  const drawText = (text: string, x: number, opts: TextOptions = {}) => {
    const { size = 10, bold = false, color = [0, 0, 0] } = opts
    const font = bold ? boldFont : regularFont
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: rgb(color[0], color[1], color[2]),
      maxWidth: CONTENT_WIDTH,
    })
    y -= LINE_HEIGHT
  }

  const drawLine = () => {
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    })
    y -= 6
  }

  const drawSectionHeader = (title: string) => {
    y -= 4
    drawText(title.toUpperCase(), MARGIN, { size: 9, bold: true, color: [0.2, 0.2, 0.2] })
    drawLine()
  }

  // Parse CV text into sections
  const lines = cvText.split('\n').map(l => l.trim()).filter(Boolean)

  let currentSection = 'header'

  for (const line of lines) {
    if (y < 60) break // Safety margin

    const isHeader = line === candidateName || line === candidateName.toUpperCase()
    const isSectionTitle = /^(PROFESSIONAL SUMMARY|EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|LANGUAGES|PROJECTS)/i.test(line)
    const isBullet = line.startsWith('•') || line.startsWith('-')
    const isSeparator = line.startsWith('---')

    if (isSeparator) continue

    if (isHeader) {
      drawText(line, MARGIN, { size: 16, bold: true })
      y -= 2
      continue
    }

    if (isSectionTitle) {
      currentSection = line.toUpperCase()
      drawSectionHeader(line)
      continue
    }

    if (isBullet) {
      const bulletText = line.replace(/^[•\-]\s*/, '')
      const wrapped = wrapText(bulletText, regularFont, 9, CONTENT_WIDTH - 12)
      for (let i = 0; i < wrapped.length; i++) {
        if (i === 0) {
          page.drawText('•', { x: MARGIN + 2, y, size: 9, font: regularFont, color: rgb(0, 0, 0) })
          drawText(wrapped[i], MARGIN + 12, { size: 9 })
        } else {
          drawText(wrapped[i], MARGIN + 12, { size: 9 })
        }
      }
      continue
    }

    // Contact line (email, phone, linkedin)
    if (currentSection === 'header' && (line.includes('@') || line.includes('|') || line.includes('linkedin'))) {
      drawText(line, MARGIN, { size: 9, color: [0.3, 0.3, 0.3] })
      continue
    }

    // Job title line (Company | Dates)
    if (line.includes('|') && currentSection === 'EXPERIENCE') {
      drawText(line, MARGIN, { size: 9, bold: true })
      continue
    }

    // Default
    const wrapped = wrapText(line, regularFont, 9, CONTENT_WIDTH)
    for (const wl of wrapped) {
      drawText(wl, MARGIN, { size: 9 })
    }
  }

  return pdfDoc.save()
}

function wrapText(text: string, font: import('pdf-lib').PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const width = font.widthOfTextAtSize(test, size)
    if (width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}
