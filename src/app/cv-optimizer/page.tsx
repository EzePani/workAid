'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, Loader2, Download, CheckCircle } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function CVOptimizerPage() {
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setCvFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') setCvFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cvFile || !jobDescription || !jobTitle || !company) return

    setStatus('loading')
    setErrorMsg('')
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    setDownloadUrl(null)

    try {
      const formData = new FormData()
      formData.append('cv', cvFile)
      formData.append('jobDescription', jobDescription)
      formData.append('jobTitle', jobTitle)
      formData.append('company', company)

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

  const isReady = cvFile && jobDescription && jobTitle && company

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
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
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

        {/* Job info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. Product Manager"
              className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Google"
              className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Job Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
          <textarea
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            rows={8}
            className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!isReady || status === 'loading'}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Optimizing your CV...
            </>
          ) : (
            'Generate Optimized CV'
          )}
        </button>

        {/* Result */}
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
