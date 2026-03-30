'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, Loader2, Download, CheckCircle, ChevronDown, Copy, AlertCircle } from 'lucide-react'

const MIN_TEXT_LENGTH = 80

type Status = 'idle' | 'loading' | 'success' | 'error'
type TrackerSaveStatus = 'idle' | 'saved' | 'duplicate' | 'error'

interface JobOption {
  id: string
  role: string
  company: string | null
  rawText: string
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then((data: JobOption[]) => setJobs(data.map(j => ({ id: j.id, role: j.role, company: j.company, rawText: j.rawText }))))
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
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    setDownloadUrl(null)

    // Save to tracker if description was pasted manually (not selected from tracker)
    if (!selectedJobId) {
      try {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText: trimmed }),
        })
        setTrackerSaveStatus(res.status === 409 ? 'duplicate' : res.ok ? 'saved' : 'error')
      } catch {
        setTrackerSaveStatus('error')
      }
    }

    try {
      const formData = new FormData()
      formData.append('cv', cvFile)
      formData.append('jobDescription', trimmed)

      const res = await fetch('/api/cv', { method: 'POST', body: formData })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'CV.pdf'

      setDownloadUrl(url)
      setDownloadName(filename)
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
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
            <><Loader2 className="w-4 h-4 animate-spin" />Optimizing your CV...</>
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

        {/* Result */}
        {status === 'success' && downloadUrl && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">CV ready!</span>
            </div>
            <a href={downloadUrl} download={downloadName} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
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
