import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WorkAid — CV Optimizer & Job Intelligence',
  description: 'Optimize your CV for ATS and analyze the job market',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <nav className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-gray-900 tracking-tight">
              Work<span className="text-blue-600">Aid</span>
            </Link>
            <div className="flex gap-6">
              <Link
                href="/cv-optimizer"
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                CV Optimizer
              </Link>
              <Link
                href="/job-tracker"
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                Job Tracker
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
      </body>
    </html>
  )
}
