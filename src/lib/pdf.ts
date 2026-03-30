import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib'

// ── Layout constants ──────────────────────────────────────────────────────────
const MARGIN       = 50
const PAGE_WIDTH   = 595   // A4
const PAGE_HEIGHT  = 841   // A4
const CONTENT_W    = PAGE_WIDTH - MARGIN * 2
const BODY_SIZE    = 9
const NAME_SIZE    = 18
const SUB_SIZE     = 9
const BODY_LH      = 13   // line height for body text
const SECTION_GAP  = 6    // extra space before section header
const ENTRY_GAP    = 5    // space between experience entries
const GRAY         = rgb(0.35, 0.35, 0.35)
const BLACK        = rgb(0, 0, 0)
const DARK         = rgb(0.15, 0.15, 0.15)

// ── Helpers ───────────────────────────────────────────────────────────────────
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function textWidth(text: string, font: PDFFont, size: number): number {
  return font.widthOfTextAtSize(text, size)
}

// ── PDF generator ─────────────────────────────────────────────────────────────
export async function generateCVPdf(cvText: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page   = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const italic  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  let y = PAGE_HEIGHT - MARGIN

  // ── Drawing primitives ──────────────────────────────────────────────────────
  const draw = (text: string, x: number, font: PDFFont, size: number, color = BLACK) => {
    page.drawText(text, { x, y, size, font, color })
    y -= BODY_LH
  }

  const drawNoAdvance = (text: string, x: number, font: PDFFont, size: number, color = BLACK) => {
    page.drawText(text, { x, y, size, font, color })
  }

  const drawLine = () => {
    page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end:   { x: PAGE_WIDTH - MARGIN, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    })
    y -= 5
  }

  const drawCentered = (text: string, font: PDFFont, size: number, color = BLACK) => {
    const w = textWidth(text, font, size)
    const x = MARGIN + (CONTENT_W - w) / 2
    page.drawText(text, { x, y, size, font, color })
    y -= BODY_LH
  }

  const drawSectionHeader = (title: string) => {
    y -= SECTION_GAP
    draw(title.toUpperCase(), MARGIN, bold, BODY_SIZE, DARK)
    drawLine()
  }

  // Two-column row: left text (fontL) + right text (fontR), both on same y
  const drawTwoCol = (
    left: string, fontL: PDFFont,
    right: string, fontR: PDFFont,
    size: number,
  ) => {
    const rw = textWidth(right, fontR, size)
    drawNoAdvance(left, MARGIN, fontL, size, BLACK)
    drawNoAdvance(right, PAGE_WIDTH - MARGIN - rw, fontR, size, DARK)
    y -= BODY_LH
  }

  // Skills line: "Category::" in bold + rest in regular, with wrapping
  const drawSkillLine = (line: string) => {
    const sep = line.indexOf('::')
    if (sep === -1) {
      const wrapped = wrapText(line, regular, BODY_SIZE, CONTENT_W)
      for (const l of wrapped) draw(l, MARGIN, regular, BODY_SIZE)
      return
    }
    const prefix = line.slice(0, sep + 2)   // "Category::"
    const rest   = line.slice(sep + 2)       // " skill1, skill2"
    const pw = textWidth(prefix, bold, BODY_SIZE)
    drawNoAdvance(prefix, MARGIN, bold, BODY_SIZE)
    const maxRest = CONTENT_W - pw
    const wrapped = wrapText(rest.trimStart(), regular, BODY_SIZE, maxRest)
    for (let i = 0; i < wrapped.length; i++) {
      if (i === 0) {
        page.drawText(wrapped[i], { x: MARGIN + pw, y, size: BODY_SIZE, font: regular, color: BLACK })
        y -= BODY_LH
      } else {
        draw(wrapped[i], MARGIN + pw, regular, BODY_SIZE)
      }
    }
  }

  // Bullet with hanging indent
  const drawBullet = (text: string) => {
    const indent = 14
    const maxW   = CONTENT_W - indent
    const wrapped = wrapText(text, regular, BODY_SIZE, maxW)
    for (let i = 0; i < wrapped.length; i++) {
      if (i === 0) {
        drawNoAdvance('•', MARGIN + 2, regular, BODY_SIZE, DARK)
        page.drawText(wrapped[i], { x: MARGIN + indent, y, size: BODY_SIZE, font: regular, color: BLACK })
        y -= BODY_LH
      } else {
        draw(wrapped[i], MARGIN + indent, regular, BODY_SIZE)
      }
    }
  }

  // ── Parse and render ────────────────────────────────────────────────────────
  const rawLines = cvText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  type Section = 'header' | 'profile' | 'experience' | 'skills' | 'languages' | 'other'
  let section: Section = 'header'
  let headerLineIdx = 0   // 0=name, 1=location, 2=contact
  let prevWasEntry = false // track spacing between experience entries

  for (const line of rawLines) {
    if (y < 60) break  // safety floor

    // Strip --- separators
    if (/^-{3,}$/.test(line)) continue

    // ── Section detection ─────────────────────────────────────────────────────
    const sectionMatch = /^(PROFILE|PROFESSIONAL EXPERIENCE|EXPERIENCE|SKILLS|LANGUAGES|EDUCATION|CERTIFICATIONS|PROJECTS)$/i.test(line)
    if (sectionMatch) {
      prevWasEntry = false
      const key = line.toUpperCase()
      if (key.includes('EXPERIENCE'))        section = 'experience'
      else if (key === 'PROFILE')            section = 'profile'
      else if (key === 'SKILLS')             section = 'skills'
      else if (key === 'LANGUAGES')          section = 'languages'
      else                                   section = 'other'
      drawSectionHeader(line)
      continue
    }

    // ── Header block (name + location + contact) ──────────────────────────────
    if (section === 'header') {
      if (headerLineIdx === 0) {
        // Name
        y -= 4
        drawCentered(line, bold, NAME_SIZE)
        y -= 2
      } else if (headerLineIdx === 1) {
        // Location
        drawCentered(line, regular, SUB_SIZE, GRAY)
      } else {
        // Contact
        drawCentered(line, regular, SUB_SIZE, GRAY)
        y -= 4
      }
      headerLineIdx++
      continue
    }

    // ── Profile ───────────────────────────────────────────────────────────────
    if (section === 'profile') {
      const wrapped = wrapText(line, regular, BODY_SIZE, CONTENT_W)
      for (const l of wrapped) draw(l, MARGIN, regular, BODY_SIZE)
      continue
    }

    // ── Experience ────────────────────────────────────────────────────────────
    if (section === 'experience') {
      if (line.startsWith('[TITLE]')) {
        if (prevWasEntry) y -= ENTRY_GAP
        const parts = line.replace('[TITLE]', '').trim().split('|').map(s => s.trim())
        drawTwoCol(parts[0] ?? '', bold, parts[1] ?? '', italic, BODY_SIZE)
        prevWasEntry = false
        continue
      }
      if (line.startsWith('[META]')) {
        const parts = line.replace('[META]', '').trim().split('|').map(s => s.trim())
        drawTwoCol(parts[0] ?? '', italic, parts[1] ?? '', italic, BODY_SIZE)
        y -= 1
        prevWasEntry = false
        continue
      }
      if (line.startsWith('•') || line.startsWith('-')) {
        drawBullet(line.replace(/^[•\-]\s*/, ''))
        prevWasEntry = true
        continue
      }
      // fallback plain text in experience
      const wrapped = wrapText(line, regular, BODY_SIZE, CONTENT_W)
      for (const l of wrapped) draw(l, MARGIN, regular, BODY_SIZE)
      continue
    }

    // ── Skills ────────────────────────────────────────────────────────────────
    if (section === 'skills') {
      drawSkillLine(line)
      y -= 1
      continue
    }

    // ── Languages / Other ─────────────────────────────────────────────────────
    const wrapped = wrapText(line, regular, BODY_SIZE, CONTENT_W)
    for (const l of wrapped) draw(l, MARGIN, regular, BODY_SIZE)
  }

  // Footer: last updated + name
  const footerY = 28
  const footerLeft  = 'Last updated: ' + new Date().toISOString().slice(0, 10)
  const footerRight = rawLines[0] ?? ''
  page.drawText(footerLeft,  { x: MARGIN, y: footerY, size: 7, font: italic, color: rgb(0.6, 0.6, 0.6) })
  const rw = textWidth(footerRight, italic, 7)
  page.drawText(footerRight, { x: PAGE_WIDTH - MARGIN - rw, y: footerY, size: 7, font: italic, color: rgb(0.6, 0.6, 0.6) })

  return pdfDoc.save()
}
