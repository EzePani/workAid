'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, BarChart2 } from 'lucide-react'

const LINKS = [
  { href: '/cv-optimizer', label: 'CV Optimizer', icon: FileText },
  { href: '/job-tracker',  label: 'Job Tracker',  icon: BarChart2 },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
