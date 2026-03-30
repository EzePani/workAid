'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Upload, FileText, Loader2, Download, CheckCircle,
  ChevronDown, Copy, AlertCircle, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'

const MIN_TEXT_LENGTH = 80

type Status = 'idle' | 'loading' | 'success' | 'error'
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
  high:   { label: 'Strong match',  icon: TrendingUp,   color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  medium: { label: 'Partial match', icon: Minus,         color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  low:    { label: 'Weak match',    icon: TrendingDown,  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200'   },
}

export default function CVOptimizerPage() {
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState('')
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [trackerSaveStatus, setTrackerSaveStatus] = useState<TrackerSaveStatus>('idle')
  const [analysis, setAnalysis] = useState<CVAnalysis | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then((data: JobOption[]) =>
        setJobs(data.map(j => ({ id: j.id, role: j.role, company: j.company, rawText: j.rawText })))
      )
      .catch(() => {})
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') setCvFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') setCvFile(file)
  }

  const handleJobSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    if (!id) {
      setSelectedJobId(null)
      setJobDescription('')
      return
    }
    const job = jobs.find(j => j.id === id)
    if (job) {
      setSelectedJobId(id)
      setJobDescription(job.rawText)
      setTrackerSaveStatus('idle')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = jobDescription.trim()
    if (!cvFile || trimmed.length < MIN_TEXT_LENGTH) return

    setStatus('loading')
    setErrorMsg('')
    setTrackerSaveStatus('idle')
    setAnalysis(null)
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    setDownloadUrl(null)

    // Build shared formData for both API calls
    const makeFormData = () => {
      const fd = new FormData()
      fd.append('cv', cvFile)
      fd.append('jobDescription', trimmed)
      return fd
    }

    // Run tracker save, CV generation and analysis in parallel
    const trackerPromise = selectedJobId
      ? Promise.resolve(null)
      : fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText: trimmed }),
        })

    const [cvRes, analyzeRes] = await Promise.all([
      fetch('/api/cv', { method: 'POST', body: makeFormData() }),
      fetch('/api/cv/analyze', { method: 'POST', body: makeFormData() }),
      trackerPromise.then(res => {
        if (!res) return
        setTrackerSaveStatus(res.status === 409 ? 'duplicate' : res.ok ? 'saved' : 'error')
      }).catch(() => setTrackerSaveStatus('error')),
    ])

    // Handle analysis result
    if (analyzeRes.ok) {
      const data = await analyzeRes.json()
      setAnalysis(data)
    }

    // Handle CV PDF result
    if (!cvRes.ok) {
      const data = await cvRes.json()
      setErrorMsg(data.error || 'Something went wrong')
      setStatus('error')
      return
    }

    try {
      const blob = await cvRes.blob()
      const url = URL.createObjectURL(blob)
      const filename =
        cvRes.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'CV.pdf'
      setDownloadUrl(url)
      setDownloadName(filename)
      setStatus('success')
    } catch {
      setErrorMsg('Failed to process the generated PDF.')
      setStatus('error')
    }
  }

  const trimmedLength = jobDescription.trim().length
  const isReady = !!cvFile && trimmedLength >= MIN_TEXT_LENGTH

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">CV Optimizer</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Upload your CV and paste the job description — we&apos;ll generate an ATS-optimized 1-page PDF.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CV Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Your CV (PDF)</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
            {cvFile ? (
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium">{cvFile.name}</span>
              </div>
            ) : (
              <div className="text-gray-600">
                <Upload className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Drop your PDF here or click to browse</p>
              </div>
            )}
          </div>
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

        {/* Submit */}
        <button
          type="submit"
          disabled={!isReady || status === 'loading'}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Analyzing &amp; optimizing...</>
          ) : (
            'Generate Optimized CV'
          )}
        </button>

        {/* Tracker save feedback */}
        {trackerSaveStatus === 'saved' && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-green-600">
            <CheckCircle className="w-3.5 h-3.5" />
            Job posting saved to Job Tracker.
          </p>
        )}
        {trackerSaveStatus === 'duplicate' && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-amber-600">
            <Copy className="w-3.5 h-3.5" />
            Already in Job Tracker — skipped duplicate.
          </p>
        )}
        {trackerSaveStatus === 'error' && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="w-3.5 h-3.5" />
            Could not save to Job Tracker.
          </p>
        )}

        {/* CV Analysis panel */}
        {analysis && (
          <div className="space-y-4">
            {/* Overall fit */}
            {(() => {
              const cfg = FIT_CONFIG[analysis.overallFit]
              const Icon = cfg.icon
              return (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                  <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                </div>
              )
            })()}

            <div className="grid grid-cols-2 gap-4">
              {/* Matching skills */}
              {analysis.matchingSkills.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What you have</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.matchingSkills.map(s => (
                      <span key={s} className="text-xs bg-green-50 border border-green-200 text-green-700 rounded px-2 py-0.5">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing skills */}
              {analysis.missingSkills.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What&apos;s missing</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.missingSkills.map(s => (
                      <span key={s} className="text-xs bg-red-50 border border-red-200 text-red-600 rounded px-2 py-0.5">
                        {s}
                      </span>
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
          </div>
        )}

        {/* Download result */}
        {status === 'success' && downloadUrl && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">CV ready!</span>
            </div>
            <a
              href={downloadUrl}
              download={downloadName}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {errorMsg}
          </div>
        )}
      </form>
    </div>
  )
}
