'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Plus, Loader2, Download, Trash2, Building2, MapPin, Briefcase, Wifi } from 'lucide-react'

interface JobPosting {
  id: string
  company: string | null
  role: string
  category: string
  skills: string[]
  level: string | null
  modality: string | null
  salary: string | null
  location: string | null
  postedAt: string | null
  addedAt: string
}

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444']

export default function JobTrackerPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [rawText, setRawText] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'insights'>('list')

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
      if (res.ok) {
        setRawText('')
        setNewCategory('')
        setShowForm(false)
        fetchJobs()
      }
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  const handleExport = () => {
    const url = selectedCategory === 'all' ? '/api/jobs/export' : `/api/jobs/export?category=${encodeURIComponent(selectedCategory)}`
    window.open(url, '_blank')
  }

  // Skills frequency for chart
  const skillFreq = jobs
    .flatMap(j => j.skills)
    .reduce((acc: Record<string, number>, s) => {
      acc[s] = (acc[s] || 0) + 1
      return acc
    }, {})

  const topSkills = Object.entries(skillFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }))

  const modalityCount = jobs.reduce((acc: Record<string, number>, j) => {
    const key = j.modality || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const modalityData = Object.entries(modalityCount).map(([name, count]) => ({ name, count }))

  const levelCount = jobs.reduce((acc: Record<string, number>, j) => {
    const key = j.level || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const levelData = Object.entries(levelCount).map(([name, count]) => ({ name, count }))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
          <p className="text-gray-600 text-sm mt-1">{jobs.length} postings tracked</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-sm border border-gray-400 text-gray-700 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 transition-colors"
          >
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
            <button
              type="submit"
              disabled={adding || !rawText}
              className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {adding ? 'Analyzing...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Category filter + tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${selectedCategory === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-400 text-gray-700 hover:border-blue-400 hover:text-blue-700'}`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-400 text-gray-700 hover:border-blue-400 hover:text-blue-700'}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex border border-gray-300 rounded-lg overflow-hidden text-sm">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 transition-colors ${activeTab === 'list' ? 'bg-gray-200 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            List
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-3 py-1.5 transition-colors ${activeTab === 'insights' ? 'bg-gray-200 text-gray-900 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Insights
          </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-3">
          {jobs.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No postings yet. Add one above to get started.
            </div>
          )}
          {jobs.map(job => (
            <div key={job.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{job.role}</span>
                    {job.level && (
                      <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">{job.level}</span>
                    )}
                    <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{job.category}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-gray-500">
                    {job.company && (
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>
                    )}
                    {job.location && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                    )}
                    {job.modality && (
                      <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />{job.modality}</span>
                    )}
                    {job.salary && (
                      <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.salary}</span>
                    )}
                  </div>
                  {job.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {job.skills.slice(0, 8).map(s => (
                        <span key={s} className="text-xs bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-gray-600">{s}</span>
                      ))}
                      {job.skills.length > 8 && (
                        <span className="text-xs text-gray-400">+{job.skills.length - 8} more</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors ml-3 mt-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-6">
          {jobs.length < 2 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              Add at least 2 postings to see insights.
            </div>
          )}

          {jobs.length >= 2 && (
            <>
              {/* Top Skills */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Most Requested Skills</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topSkills} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {topSkills.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Modality */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Work Modality</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={modalityData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {modalityData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Level */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Seniority Level</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={levelData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {levelData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
