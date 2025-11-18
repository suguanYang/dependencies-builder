import '../globals.css'
import Link from 'next/link'

interface DocsLayoutProps {
  children: React.ReactNode
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Sidebar */}
          <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-8">
              <Link
                href="/docs"
                className="text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
              >
                DMS 文档
              </Link>
            </div>

            <nav className="space-y-2">
              <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                快速开始
              </div>
              <Link
                href="/docs/getting-started"
                className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 py-1"
              >
                快速开始
              </Link>

              <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                项目规划
              </div>
              <Link
                href="/docs/road-map"
                className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 py-1"
              >
                项目规划
              </Link>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto">
              <div className="prose prose-lg max-w-none dark:prose-invert">{children}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
