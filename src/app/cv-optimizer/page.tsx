'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Upload, FileText, Loader2, Download, CheckCircle,
  ChevronDown, Copy, AlertCircle, TrendingUp, TrendingDown,
  Minus, X, ArrowLeft, ScanSearch, Sparkles,
} from 'lucide-react'

const MIN_TEXT_LENGTH = 80
const SAVED_CV_KEY = 'cv_optimizer_saved_cv'

type FlowStep = 'input' | 'analyzing' | 'analyzed' | 'generating' | 'done'
type TrackerSaveStatus = 'idle' | 'saved' | 'duplicate' | 'error'

interface JobOption {
  id: string
  role: string
  company: string | null
  rawText: string
}

interface CVAnalysis {
  overallFit: 'high' | 'medium' | 'low'
  matchingSkills: string[]
  missingSkills: string[]
  suggestions: string[]
}

const FIT_CONFIG = {
  high:   { label: 'Strong match',  icon: TrendingUp,   color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200', bar: 'bg-green-500', width: 'w-4/5' },
  medium: { label: 'Partial match', icon: Minus,         color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200', bar: 'bg-amber-400', width: 'w-1/2' },
  low:    { label: 'Weak match',    icon: TrendingDown,  color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200',   bar: 'bg-red-500',   width: 'w-1/4' },
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function base64ToFile(base64: string, name: string): File {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return new File([bytes], name, { type: 'application/pdf' })
}

export default function CVOptimizerPage() {
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [savedCvName, setSavedCvName] = useState<string | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [step, setStep] = useState<FlowStep>('input')
  const [analysis, setAnalysis] = useState<CVAnalysis | null>(null)
  const [analyzeError, setAnalyzeError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [trackerSaveStatus, setTrackerSaveStatus] = useState<TrackerSaveStatus>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Restore saved CV from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_CV_KEY)
      if (raw) {
        const { name, base64 } = JSON.parse(raw)
        setCvFile(base64ToFile(base64, name))
        setSavedCvName(name)
      }
    } catch { /* ignore */ }
  }, [])

  // Fetch tracked jobs for selector
  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then((data: JobOption[]) =>
        setJobs(data.map(j => ({ id: j.id, role: j.role, company: j.company, rawText: j.rawText })))
      )
      .catch(() => {})
  }, [])

  const saveCV = async (file: File) => {
    try {
      const base64 = await fileToBase64(file)
      localStorage.setItem(SAVED_CV_KEY, JSON.stringify({ name: file.name, base64 }))
      setSavedCvName(file.name)
    } catch { /* ignore */ }
  }

  const removeSavedCV = () => {
    localStorage.removeItem(SAVED_CV_KEY)
    setSavedCvName(null)
    setCvFile(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setCvFile(file)
      saveCV(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setCvFile(file)
      saveCV(file)
    }
  }

  const handleJobSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    if (!id) { setSelectedJobId(null); setJobDescription(''); return }
    const job = jobs.find(j => j.id === id)
    if (job) { setSelectedJobId(id); setJobDescription(job.rawText) }
  }

  // Step 1 → 2: Analyze
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = jobDescription.trim()
    if (!cvFile || trimmed.length < MIN_TEXT_LENGTH) return

    setStep('analyzing')
    setAnalyzeError('')
    setAnalysis(null)

    // Save to tracker if pasted manually
    if (!selectedJobId) {
      fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: trimmed }),
      })
        .then(res => setTrackerSaveStatus(res.status === 409 ? 'duplicate' : res.ok ? 'saved' : 'error'))
        .catch(() => setTrackerSaveStatus('error'))
    }

    try {
      const fd = new FormData()
      fd.append('cv', cvFile)
      fd.append('jobDescription', trimmed)
      const res = await fetch('/api/cv/analyze', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Analysis failed')
      const data: CVAnalysis = await res.json()
      setAnalysis(data)
      setStep('analyzed')
    } catch {
      setAnalyzeError('Could not analyze the CV. Please try again.')
      setStep('input')
    }
  }

  // Step 3 → 4: Generate
  const handleGenerate = async () => {
    if (!cvFile || !analysis) return

    setStep('generating')
    setGenerateError('')
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    setDownloadUrl(null)

    try {
      const fd = new FormData()
      fd.append('cv', cvFile)
      fd.append('jobDescription', jobDescription.trim())
      fd.append('analysis', JSON.stringify(analysis))

      const res = await fetch('/api/cv', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Generation failed')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'CV.pdf'
      setDownloadUrl(url)
      setDownloadName(filename)
      setStep('done')
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('analyzed')
    }
  }

  const handleReset = () => {
    setStep('input')
    setAnalysis(null)
    setJobDescription('')
    setSelectedJobId(null)
    setTrackerSaveStatus('idle')
    setGenerateError('')
    setAnalyzeError('')
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    setDownloadUrl(null)
  }

  const trimmedLength = jobDescription.trim().length
  const isReady = !!cvFile && trimmedLength >= MIN_TEXT_LENGTH

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CV Optimizer</h1>
        </div>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          Upload your CV and paste a job description. We&apos;ll analyze how well you match the role,
          show you exactly what&apos;s missing, then generate a tailored ATS-optimized PDF — without
          inventing anything.
        </p>

        {/* Steps */}
        <div className="flex items-center gap-2 mt-4">
          {[
            { icon: Upload,     label: 'Upload CV'   },
            { icon: ScanSearch, label: 'Analyze match' },
            { icon: Sparkles,   label: 'Generate PDF'  },
            { icon: Download,   label: 'Download'      },
          ].map(({ icon: Icon, label }, i, arr) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Icon className="w-3.5 h-3.5 text-blue-500" />
                <span>{label}</span>
              </div>
              {i < arr.length - 1 && (
                <span className="text-gray-300 text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 1: Input ───────────────────────────────────────── */}
      {(step === 'input' || step === 'analyzing') && (
        <form onSubmit={handleAnalyze} className="space-y-6">
          {/* CV Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your CV (PDF)</label>
            {savedCvName && cvFile ? (
              <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-green-700">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">{savedCvName}</span>
                  <span className="text-xs bg-green-100 text-green-600 rounded-full px-2 py-0.5">Saved</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={removeSavedCV}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Remove saved CV"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                <div className="text-gray-600">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Drop your PDF here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">It will be saved for next time</p>
                </div>
              </div>
            )}
          </div>

          {/* Select from Job Tracker */}
          {jobs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select from Job Tracker</label>
              <div className="relative">
                <select
                  value={selectedJobId ?? ''}
                  onChange={handleJobSelect}
                  className="w-full appearance-none border border-gray-400 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                >
                  <option value="">— Paste manually below —</option>
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.role}{j.company ? ` · ${j.company}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Job Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
            <textarea
              value={jobDescription}
              onChange={e => { setJobDescription(e.target.value); setSelectedJobId(null) }}
              placeholder="Paste the full job description here..."
              rows={8}
              className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              {trimmedLength > 0
                ? `${trimmedLength} chars${trimmedLength < MIN_TEXT_LENGTH ? ` — need at least ${MIN_TEXT_LENGTH}` : ' ✓'}`
                : `Minimum ${MIN_TEXT_LENGTH} characters recommended`}
            </p>
          </div>

          {analyzeError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5" />{analyzeError}
            </p>
          )}

          <button
            type="submit"
            disabled={!isReady || step === 'analyzing'}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {step === 'analyzing'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing your CV...</>
              : 'Analyze Match'}
          </button>
        </form>
      )}

      {/* ── Steps 2–4: Analysis + Generate ─────────────────────── */}
      {(step === 'analyzed' || step === 'generating' || step === 'done') && analysis && (
        <div className="space-y-5">
          {/* Back to edit */}
          {step !== 'generating' && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Change job description
            </button>
          )}

          {/* Overall fit */}
          {(() => {
            const cfg = FIT_CONFIG[analysis.overallFit]
            const Icon = cfg.icon
            return (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                <Icon className={`w-5 h-5 ${cfg.color} shrink-0`} />
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
                  <div className="mt-1.5 h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${cfg.bar} ${cfg.width} transition-all`} />
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Matching / Missing */}
          <div className="grid grid-cols-2 gap-4">
            {analysis.matchingSkills.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What you have</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.matchingSkills.map(s => (
                    <span key={s} className="text-xs bg-green-50 border border-green-200 text-green-700 rounded px-2 py-0.5">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {analysis.missingSkills.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What&apos;s missing</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.missingSkills.map(s => (
                    <span key={s} className="text-xs bg-red-50 border border-red-200 text-red-600 rounded px-2 py-0.5">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recommendations</p>
              <ul className="space-y-2">
                {analysis.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 w-4 h-4 shrink-0 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tracker feedback */}
          {trackerSaveStatus === 'saved' && (
            <p className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle className="w-3.5 h-3.5" />Job posting saved to Job Tracker.
            </p>
          )}
          {trackerSaveStatus === 'duplicate' && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <Copy className="w-3.5 h-3.5" />Already in Job Tracker — skipped duplicate.
            </p>
          )}

          {/* Generate button */}
          {(step === 'analyzed' || step === 'generating') && (
            <div className="space-y-2">
              {generateError && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />{generateError}
                </p>
              )}
              <button
                onClick={handleGenerate}
                disabled={step === 'generating'}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {step === 'generating'
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Generating optimized CV...</>
                  : 'Generate Optimized CV'}
              </button>
              <p className="text-center text-xs text-gray-400">
                We&apos;ll use the analysis above to close the gaps and pass ATS filters.
              </p>
            </div>
          )}

          {/* Download */}
          {step === 'done' && downloadUrl && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium">Your optimized CV is ready</p>
                  <p className="text-xs text-green-600">{downloadName}</p>
                </div>
              </div>
              <a
                href={downloadUrl}
                download={downloadName}
                className="flex items-center gap-1.5 text-sm font-medium bg-white border border-green-300 text-green-700 hover:bg-green-50 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
