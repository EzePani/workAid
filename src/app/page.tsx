import Link from 'next/link'
import { FileText, BarChart2, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-3">
        Work<span className="text-blue-600">Aid</span>
      </h1>
      <p className="text-gray-600 text-lg mb-12 max-w-xl">
        Optimize your CV for ATS filters and understand the job market — all in one place.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <Link
          href="/cv-optimizer"
          className="group bg-white border border-gray-200 rounded-2xl p-8 text-left hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">CV Optimizer</h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload your CV and a job description. Get an ATS-optimized, Harvard-format PDF in seconds.
          </p>
          <span className="text-sm font-medium text-blue-600 flex items-center gap-1 group-hover:gap-2 transition-all">
            Start optimizing <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          href="/job-tracker"
          className="group bg-white border border-gray-200 rounded-2xl p-8 text-left hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
            <BarChart2 className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Job Tracker</h2>
          <p className="text-sm text-gray-600 mb-4">
            Paste job postings, extract insights automatically, and compare dozens of offers side by side.
          </p>
          <span className="text-sm font-medium text-blue-600 flex items-center gap-1 group-hover:gap-2 transition-all">
            Track jobs <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
    </div>
  )
}
