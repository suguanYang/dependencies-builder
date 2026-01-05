import '../globals.css'
import { AuthProvider } from '@/contexts/auth-context'

export default function ExternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" sizes="256x256" type="image/x-icon" />
      </head>
      <body>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50">
            {/* Main Content - No Sidebar/Navbar */}
            <main>{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
