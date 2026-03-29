'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Plus, Loader2, Download, Trash2, Building2, MapPin, Briefcase,
  Wifi, Link, FileText, X, ExternalLink
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
}

const HARD_COLORS = ['#3b82f6', '#6366f1', '#2563eb', '#4f46e5', '#1d4ed8', '#7c3aed', '#0284c7', '#0369a1', '#1e40af', '#312e81']
const SOFT_COLORS = ['#10b981', '#059669', '#f59e0b', '#d97706', '#ec4899', '#db2777', '#14b8a6', '#0d9488', '#84cc16', '#65a30d']

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

// ── Detail Modal ──────────────────────────────────────────────────────────────
function JobDetailModal({ job, onClose }: { job: JobPosting; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{job.role}</h2>
            {job.company && <p className="text-sm text-gray-600 mt-0.5">{job.company}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            {job.level && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 font-medium">{job.level}</span>}
            <span className="text-xs bg-gray-100 text-gray-700 border border-gray-200 rounded-full px-3 py-1">{job.category}</span>
            {job.modality && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1">{job.modality}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {job.location && <div className="flex items-center gap-2 text-gray-700"><MapPin className="w-4 h-4 text-gray-400 shrink-0" />{job.location}</div>}
            {job.salary && <div className="flex items-center gap-2 text-gray-700"><Briefcase className="w-4 h-4 text-gray-400 shrink-0" />{job.salary}</div>}
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JobTrackerPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [rawText, setRawText] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'insights'>('list')
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null)

  const fetchJobs = useCallback(async () => {
    const url = selectedCategory === 'all' ? '/api/jobs' : `/api/jobs?category=${encodeURIComponent(selectedCategory)}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setJobs(data)
      const cats = Array.from(new Set(data.map((j: JobPosting) => j.category))) as string[]
      setCategories(cats)
    }
  }, [selectedCategory])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rawText) return
    setAdding(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, category: newCategory || undefined }),
      })
      if (res.ok) { setRawText(''); setNewCategory(''); setShowForm(false); fetchJobs() }
    } finally { setAdding(false) }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    setJobs(prev => prev.filter(j => j.id !== id))
    if (selectedJob?.id === id) setSelectedJob(null)
  }

  const handleExport = () => {
    const url = selectedCategory === 'all' ? '/api/jobs/export' : `/api/jobs/export?category=${encodeURIComponent(selectedCategory)}`
    window.open(url, '_blank')
  }

  const hardSkillsData = buildFreqData(jobs.flatMap(j => j.skills))
  const softSkillsData = buildFreqData(jobs.flatMap(j => j.softSkills ?? []))
  const levelData = Object.entries(
    jobs.reduce((acc: Record<string, number>, j) => { const k = j.level || 'Unknown'; acc[k] = (acc[k] || 0) + 1; return acc }, {})
  ).map(([name, count]) => ({ name, count }))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
          <p className="text-gray-600 text-sm mt-1">{jobs.length} postings tracked</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 text-sm border border-gray-400 text-gray-700 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 text-sm bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Posting
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Paste job posting</h2>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="Paste the full job posting text from LinkedIn, Indeed, etc..."
            rows={6}
            className="w-full border border-gray-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex gap-3">
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="Category (auto-detected if empty)"
              className="flex-1 border border-gray-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" disabled={adding || !rawText}
              className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {adding ? 'Analyzing...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Category filter + tabs */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSelectedCategory('all')}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${selectedCategory === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-400 text-gray-700 hover:border-blue-400 hover:text-blue-700'}`}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-400 text-gray-700 hover:border-blue-400 hover:text-blue-700'}`}>
              {cat}
            </button>
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

      {/* List */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {jobs.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">No postings yet. Add one above to get started.</div>
          )}
          {jobs.map(job => (
            <div key={job.id} onClick={() => setSelectedJob(job)}
              className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{job.role}</span>
                    {job.level && <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">{job.level}</span>}
                    <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{job.category}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-gray-600">
                    {job.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>}
                    {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                    {job.modality && <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />{job.modality}</span>}
                    {job.salary && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.salary}</span>}
                    {job.url && <span className="flex items-center gap-1 text-blue-600"><Link className="w-3 h-3" />Link</span>}
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
                <button onClick={e => { e.stopPropagation(); handleDelete(job.id) }}
                  className="text-gray-300 hover:text-red-500 transition-colors ml-3 mt-0.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {jobs.length < 2 && (
            <div className="text-center py-16 text-gray-500 text-sm">Add at least 2 postings to see insights.</div>
          )}
          {jobs.length >= 2 && (
            <>
              {/* Hard + Soft side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SkillsChart title="Hard Skills" data={hardSkillsData} colors={HARD_COLORS} />
                <SkillsChart title="Soft Skills" data={softSkillsData} colors={SOFT_COLORS} />
              </div>

              {/* Seniority — full width, cross all categories */}
              {levelData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Seniority Level</h3>
                  <p className="text-xs text-gray-500 mb-4">Across all categories</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={levelData}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {levelData.map((_, i) => <Cell key={i} fill={HARD_COLORS[i % HARD_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  )
}
