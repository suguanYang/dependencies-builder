import './globals.css'
import { SidebarProvider } from '@/contexts/sidebar-context'
import { CollapsibleNavigation } from '@/components/collapsible-navigation'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <SidebarProvider>
          <div className="min-h-screen bg-gray-50 flex">
            {/* Collapsible Navigation */}
            <CollapsibleNavigation />

            {/* Main Content */}
            <main className="flex-1">{children}</main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  )
}
