'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Plus, Loader2, Download, Trash2, Building2, MapPin, Briefcase,
  Wifi, Link, FileText, X, ExternalLink, Search, AlertCircle, Copy,
  Pencil, Check
} from 'lucide-react'

interface JobPosting {
  id: string
  company: string | null
  role: string
  category: string
  skills: string[]
  softSkills: string[]
  level: string | null
  modality: string | null
  salary: string | null
  location: string | null
  url: string | null
  postedAt: string | null
  addedAt: string
  rawText: string
  status: string
  notes: string | null
}

const STATUSES = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected'] as const
type Status = typeof STATUSES[number]

const STATUS_STYLE: Record<Status, { bg: string; text: string; border: string; dot: string }> = {
  'Not Applied': { bg: 'bg-gray-100',  text: 'text-gray-600',  border: 'border-gray-200',  dot: 'bg-gray-400'  },
  'Applied':     { bg: 'bg-blue-50',   text: 'text-blue-700',  border: 'border-blue-200',  dot: 'bg-blue-500'  },
  'Interview':   { bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'Offer':       { bg: 'bg-green-50',  text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
  'Rejected':    { bg: 'bg-red-50',    text: 'text-red-600',   border: 'border-red-200',   dot: 'bg-red-500'   },
}

const LEVELS    = ['Junior', 'Mid', 'Senior', 'Lead']
const MODALITIES = ['Remote', 'Hybrid', 'On-site']

const HARD_COLORS = ['#3b82f6', '#6366f1', '#2563eb', '#4f46e5', '#1d4ed8', '#7c3aed', '#0284c7', '#0369a1', '#1e40af', '#312e81']
const SOFT_COLORS = ['#10b981', '#059669', '#f59e0b', '#d97706', '#ec4899', '#db2777', '#14b8a6', '#0d9488', '#84cc16', '#65a30d']
const MIN_TEXT_LENGTH = 80

function truncateLabel(label: string, max = 24): string {
  return label.length > max ? label.slice(0, max) + '…' : label
}

function buildFreqData(items: string[]) {
  const freq = items.reduce((acc: Record<string, number>, s) => {
    acc[s] = (acc[s] || 0) + 1; return acc
  }, {})
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name: truncateLabel(name), fullName: name, count }))
}

function StatusBadge({ status }: { status: string }) {
  const s = status as Status
  const style = STATUS_STYLE[s] ?? STATUS_STYLE['Not Applied']
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function JobDetailModal({
  job, onClose, onStatusChange, onJobEdit,
}: {
  job: JobPosting
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
  onJobEdit: (updated: JobPosting) => void
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState({
    role:     job.role,
    company:  job.company  ?? '',
    location: job.location ?? '',
    salary:   job.salary   ?? '',
    url:      job.url      ?? '',
    level:    job.level    ?? '',
    modality: job.modality ?? '',
    category: job.category,
    notes:    job.notes    ?? '',
  })

  const field = (key: keyof typeof editData, id: string, placeholder?: string) => (
    <input
      id={id}
      type="text"
      value={editData[key]}
      placeholder={placeholder}
      onChange={e => setEditData(d => ({ ...d, [key]: e.target.value }))}
      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        const updated: JobPosting = await res.json()
        onJobEdit(updated)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === job.status) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) onStatusChange(job.id, newStatus)
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Job detail: ${job.role}${job.company ? ` at ${job.company}` : ''}`}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1 min-w-0 pr-4">
            {editing ? (
              <div className="space-y-2">
                <div>
                  <label htmlFor="edit-role" className="block text-xs font-medium text-gray-700 mb-1">
                    Role <span aria-hidden="true" className="text-red-500">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <input
                    id="edit-role"
                    type="text"
                    value={editData.role}
                    onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}
                    aria-required="true"
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="edit-company" className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                  <input
                    id="edit-company"
                    type="text"
                    value={editData.company}
                    onChange={e => setEditData(d => ({ ...d, company: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900">{job.role}</h2>
                {job.company && <p className="text-sm text-gray-600 mt-0.5">{job.company}</p>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving || !editData.role.trim()}
                  className="flex items-center gap-1 text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  aria-label="Save changes"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-sm border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  aria-label="Cancel editing"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-sm border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                aria-label="Edit this job posting"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Status selector */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Application Status</legend>
            <div className={`flex flex-wrap gap-2 ${updatingStatus ? 'opacity-60 pointer-events-none' : ''}`}>
              {STATUSES.map(s => {
                const style = STATUS_STYLE[s]
                const active = job.status === s
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    aria-pressed={active}
                    aria-label={`Set status to ${s}`}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                      active
                        ? `${style.bg} ${style.text} ${style.border} ring-2 ring-offset-1 ring-current`
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? style.dot : 'bg-gray-300'}`} />
                    {s}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {/* Badges / editable meta */}
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-level" className="block text-xs font-medium text-gray-700 mb-1">Level</label>
                <select
                  id="edit-level"
                  value={editData.level}
                  onChange={e => setEditData(d => ({ ...d, level: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— none —</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="edit-modality" className="block text-xs font-medium text-gray-700 mb-1">Modality</label>
                <select
                  id="edit-modality"
                  value={editData.modality}
                  onChange={e => setEditData(d => ({ ...d, modality: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— none —</option>
                  {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="edit-location" className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                {field('location', 'edit-location')}
              </div>
              <div>
                <label htmlFor="edit-salary" className="block text-xs font-medium text-gray-700 mb-1">Salary</label>
                {field('salary', 'edit-salary')}
              </div>
              <div className="col-span-2">
                <label htmlFor="edit-url" className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                {field('url', 'edit-url')}
              </div>
              <div className="col-span-2">
                <label htmlFor="edit-category" className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                {field('category', 'edit-category')}
              </div>
              <div className="col-span-2">
                <label htmlFor="edit-notes" className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  id="edit-notes"
                  value={editData.notes}
                  onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                  rows={3}
                  placeholder="Personal notes about this position…"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {job.level && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 font-medium">{job.level}</span>}
                <span className="text-xs bg-gray-100 text-gray-700 border border-gray-200 rounded-full px-3 py-1">{job.category}</span>
                {job.modality && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1">{job.modality}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {job.location && <div className="flex items-center gap-2 text-gray-700"><MapPin className="w-4 h-4 text-gray-400 shrink-0" />{job.location}</div>}
                {job.salary   && <div className="flex items-center gap-2 text-gray-700"><Briefcase className="w-4 h-4 text-gray-400 shrink-0" />{job.salary}</div>}
                {job.modality && <div className="flex items-center gap-2 text-gray-700"><Wifi className="w-4 h-4 text-gray-400 shrink-0" />{job.modality}</div>}
                {job.postedAt && <div className="flex items-center gap-2 text-gray-700"><FileText className="w-4 h-4 text-gray-400 shrink-0" />{new Date(job.postedAt).toLocaleDateString()}</div>}
              </div>

              {job.url && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Source</p>
                  <a href={job.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline break-all">
                    <ExternalLink className="w-4 h-4 shrink-0" />{job.url}
                  </a>
                </div>
              )}

              {job.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.notes}</p>
                </div>
              )}
            </>
          )}

          {job.skills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hard Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map(s => (
                  <span key={s} className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 text-blue-700">{s}</span>
                ))}
              </div>
            </div>
          )}

          {job.softSkills?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Soft Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {job.softSkills.map(s => (
                  <span key={s} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1 text-green-700">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Full Description</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {job.rawText}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Skills Chart ──────────────────────────────────────────────────────────────
function SkillsChart({ title, data, colors }: { title: string; data: { name: string; fullName: string; count: number }[]; colors: string[] }) {
  if (data.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={data.length * 32 + 20}>
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 32, top: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value, _, props) => [value, props.payload.fullName]} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Filter Pill ───────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-700'
      }`}
    >
      {label}
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JobTrackerPage() {
  const [jobs, setJobs]                     = useState<JobPosting[]>([])
  const [categories, setCategories]         = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedLevel, setSelectedLevel]   = useState('all')
  const [selectedModality, setSelectedModality] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery]       = useState('')
  const [rawText, setRawText]               = useState('')
  const [formError, setFormError]           = useState<{ type: 'error' | 'duplicate'; message: string } | null>(null)
  const [adding, setAdding]                 = useState(false)
  const [showForm, setShowForm]             = useState(false)
  const [activeTab, setActiveTab]           = useState<'list' | 'insights'>('list')
  const [selectedJob, setSelectedJob]       = useState<JobPosting | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/jobs')
    if (res.ok) {
      const data = await res.json()
      setJobs(data)
      const cats = Array.from(new Set(data.map((j: JobPosting) => j.category))) as string[]
      setCategories(cats)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const availableLevels = useMemo(
    () => Array.from(new Set(jobs.map(j => j.level).filter(Boolean))) as string[],
    [jobs]
  )
  const availableModalities = useMemo(
    () => Array.from(new Set(jobs.map(j => j.modality).filter(Boolean))) as string[],
    [jobs]
  )

  const filteredJobs = useMemo(() => jobs.filter(job => {
    if (selectedCategory !== 'all' && job.category !== selectedCategory) return false
    if (selectedLevel    !== 'all' && job.level    !== selectedLevel)    return false
    if (selectedModality !== 'all' && job.modality !== selectedModality) return false
    if (selectedStatus   !== 'all' && job.status   !== selectedStatus)   return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        job.role.toLowerCase().includes(q) ||
        (job.company?.toLowerCase().includes(q) ?? false) ||
        (job.location?.toLowerCase().includes(q) ?? false) ||
        job.skills.some(s => s.toLowerCase().includes(q)) ||
        (job.softSkills?.some(s => s.toLowerCase().includes(q)) ?? false)
      )
    }
    return true
  }), [jobs, selectedCategory, selectedLevel, selectedModality, selectedStatus, searchQuery])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const trimmed = rawText.trim()
    if (!trimmed) {
      setFormError({ type: 'error', message: 'Please paste a job posting before saving.' })
      return
    }
    if (trimmed.length < MIN_TEXT_LENGTH) {
      setFormError({ type: 'error', message: `Too short (${trimmed.length} chars). Paste the full job description for better results.` })
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: trimmed }),
      })
      if (res.status === 409) {
        const data = await res.json()
        const where = data.company ? `${data.role} at ${data.company}` : data.role
        setFormError({ type: 'duplicate', message: `Already tracked: "${where}". Check your list to avoid duplicates.` })
        return
      }
      if (res.ok) {
        setRawText('')
        setShowForm(false)
        fetchJobs()
      } else {
        setFormError({ type: 'error', message: 'Something went wrong. Please try again.' })
      }
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    setJobs(prev => prev.filter(j => j.id !== id))
    if (selectedJob?.id === id) setSelectedJob(null)
    setConfirmDeleteId(null)
  }

  const handleStatusChange = (id: string, newStatus: string) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: newStatus } : j))
    setSelectedJob(prev => prev?.id === id ? { ...prev, status: newStatus } : prev)
  }

  const handleJobEdit = (updated: JobPosting) => {
    setJobs(prev => prev.map(j => j.id === updated.id ? updated : j))
    setSelectedJob(updated)
    const cats = Array.from(new Set([...jobs.map(j => j.category), updated.category]))
    setCategories(cats)
  }

  const handleExport = () => {
    const url = selectedCategory === 'all'
      ? '/api/jobs/export'
      : `/api/jobs/export?category=${encodeURIComponent(selectedCategory)}`
    window.open(url, '_blank')
  }

  const clearAllFilters = () => {
    setSelectedCategory('all')
    setSelectedLevel('all')
    setSelectedModality('all')
    setSelectedStatus('all')
    setSearchQuery('')
  }

  const hasActiveFilters = selectedCategory !== 'all' || selectedLevel !== 'all' || selectedModality !== 'all' || selectedStatus !== 'all' || searchQuery.trim() !== ''
  const hardSkillsData = buildFreqData(filteredJobs.flatMap(j => j.skills))
  const softSkillsData = buildFreqData(filteredJobs.flatMap(j => j.softSkills ?? []))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
          <p className="text-gray-600 text-sm mt-1">
            {hasActiveFilters ? `${filteredJobs.length} of ${jobs.length} postings` : `${jobs.length} postings tracked`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 text-sm border border-gray-400 text-gray-700 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
            aria-label="Export jobs to CSV">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setShowForm(v => !v); setFormError(null) }}
            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 transition-colors"
            aria-label="Add new job posting">
            <Plus className="w-4 h-4" /> Add Posting
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Paste job posting</h2>
          <div>
            <textarea
              value={rawText}
              onChange={e => { setRawText(e.target.value); if (formError?.type === 'error') setFormError(null) }}
              placeholder="Paste the full job posting text from LinkedIn, Indeed, etc..."
              rows={7}
              aria-label="Job posting text"
              className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 resize-none transition-colors ${
                formError?.type === 'error'     ? 'border-red-400 focus:ring-red-400'
                : formError?.type === 'duplicate' ? 'border-amber-400 focus:ring-amber-400'
                : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            <div className="mt-1 min-h-[1.25rem]">
              {formError ? (
                <p className={`flex items-start gap-1 text-xs ${formError.type === 'duplicate' ? 'text-amber-700' : 'text-red-600'}`} role="alert">
                  {formError.type === 'duplicate'
                    ? <Copy className="w-3 h-3 mt-0.5 shrink-0" />
                    : <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />}
                  {formError.message}
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  {rawText.trim().length > 0
                    ? `${rawText.trim().length} chars${rawText.trim().length < MIN_TEXT_LENGTH ? ` — need at least ${MIN_TEXT_LENGTH}` : ' ✓'}`
                    : `Minimum ${MIN_TEXT_LENGTH} characters recommended`}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setFormError(null); setRawText('') }}
              className="text-sm border border-gray-300 text-gray-600 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={adding || !rawText.trim()}
              className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {adding ? 'Analyzing…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Category filter + tabs */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <FilterPill label="All" active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')} />
          {categories.map(cat => (
            <FilterPill key={cat} label={cat} active={selectedCategory === cat} onClick={() => setSelectedCategory(cat)} />
          ))}
        </div>
        <div className="flex border border-gray-300 rounded-lg overflow-hidden text-sm">
          <button onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 transition-colors ${activeTab === 'list' ? 'bg-gray-200 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}>
            List
          </button>
          <button onClick={() => setActiveTab('insights')}
            className={`px-3 py-1.5 transition-colors ${activeTab === 'insights' ? 'bg-gray-200 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}>
            Insights
          </button>
        </div>
      </div>

      {/* Search + filters */}
      {activeTab === 'list' && jobs.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by role, company, location, or skill…"
              aria-label="Search job postings"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-gray-400 font-medium">Status:</span>
              <FilterPill label="All" active={selectedStatus === 'all'} onClick={() => setSelectedStatus('all')} />
              {STATUSES.map(s => {
                const style = STATUS_STYLE[s]
                const active = selectedStatus === s
                return (
                  <button key={s} onClick={() => setSelectedStatus(s)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      active ? `${style.bg} ${style.text} ${style.border}` : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? style.dot : 'bg-gray-300'}`} />
                    {s}
                  </button>
                )
              })}
            </div>

            {availableLevels.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-gray-400 font-medium">Level:</span>
                <FilterPill label="All" active={selectedLevel === 'all'} onClick={() => setSelectedLevel('all')} />
                {availableLevels.map(l => (
                  <FilterPill key={l} label={l} active={selectedLevel === l} onClick={() => setSelectedLevel(l)} />
                ))}
              </div>
            )}

            {availableModalities.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-gray-400 font-medium">Modality:</span>
                <FilterPill label="All" active={selectedModality === 'all'} onClick={() => setSelectedModality('all')} />
                {availableModalities.map(m => (
                  <FilterPill key={m} label={m} active={selectedModality === m} onClick={() => setSelectedModality(m)} />
                ))}
              </div>
            )}

            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="text-red-500 hover:text-red-700 underline ml-1">
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {jobs.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">No postings yet. Add one above to get started.</div>
          )}
          {jobs.length > 0 && filteredJobs.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              No postings match your filters.{' '}
              <button onClick={clearAllFilters} className="text-blue-600 hover:underline">Clear filters</button>
            </div>
          )}
          {filteredJobs.map(job => (
            <div key={job.id} onClick={() => { if (confirmDeleteId !== job.id) setSelectedJob(job) }}
              className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{job.role}</span>
                    {job.level && <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">{job.level}</span>}
                    <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{job.category}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-gray-600">
                    {job.company  && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>}
                    {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                    {job.modality && <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />{job.modality}</span>}
                    {job.salary   && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.salary}</span>}
                    {job.url      && <span className="flex items-center gap-1 text-blue-600"><Link className="w-3 h-3" />Link</span>}
                  </div>
                  {job.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {job.skills.slice(0, 5).map(s => (
                        <span key={s} className="text-xs bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 text-blue-700">{s}</span>
                      ))}
                      {job.softSkills?.slice(0, 3).map(s => (
                        <span key={s} className="text-xs bg-green-50 border border-green-100 rounded px-1.5 py-0.5 text-green-700">{s}</span>
                      ))}
                      {(job.skills.length + (job.softSkills?.length ?? 0)) > 8 && (
                        <span className="text-xs text-gray-500">+{job.skills.length + (job.softSkills?.length ?? 0) - 8} more</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right column: status badge + delete */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={job.status} />

                  {confirmDeleteId === job.id ? (
                    <div
                      className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="text-xs text-red-700 font-medium">Delete?</span>
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="text-xs text-white bg-red-600 hover:bg-red-700 rounded px-2 py-0.5 transition-colors"
                        aria-label="Confirm delete"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-600 hover:text-gray-900"
                        aria-label="Cancel delete"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(job.id) }}
                      className="group flex items-center gap-1 text-gray-300 hover:text-red-500 transition-colors"
                      aria-label={`Delete ${job.role}${job.company ? ` at ${job.company}` : ''}`}
                      title="Delete job posting"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Delete
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {filteredJobs.length < 2 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              {jobs.length < 2 ? 'Add at least 2 postings to see insights.' : 'Not enough postings match your current filters.'}
            </div>
          )}
          {filteredJobs.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkillsChart title="Hard Skills" data={hardSkillsData} colors={HARD_COLORS} />
              <SkillsChart title="Soft Skills" data={softSkillsData} colors={SOFT_COLORS} />
            </div>
          )}
        </div>
      )}

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onStatusChange={handleStatusChange}
          onJobEdit={handleJobEdit}
        />
      )}
    </div>
  )
}
