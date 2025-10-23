'use client'

import React from 'react'
import {
  HomeIcon,
  NetworkIcon,
  BarChart3Icon,
  PanelLeftOpenIcon,
  PanelLeftCloseIcon,
  Cuboid,
  Send,
  Folder,
  Database,
  LogOut,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/contexts/sidebar-context'
import { useAuth } from '@/contexts/auth-context'

interface NavigationItem {
  name: string
  href: string
  icon: React.ElementType
  description?: string
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Home',
    href: '/',
    icon: HomeIcon,
    description: 'Back to dashboard',
  },
  {
    name: 'Projects',
    href: '/projects',
    icon: Folder,
    description: 'Manage all projects',
  },
  {
    name: 'Nodes',
    href: '/nodes',
    icon: Cuboid,
    description: 'Manage all nodes',
  },
  {
    name: 'Connections',
    href: '/connections',
    icon: NetworkIcon,
    description: 'Manage dependency connections',
  },
  {
    name: 'Actions',
    href: '/actions',
    icon: Send,
    description: 'Create and manage actions',
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3Icon,
    description: 'View analysis reports',
  },
]

const adminNavigationItems: NavigationItem[] = [
  {
    name: 'Database Admin',
    href: '/database-admin',
    icon: Database,
    description: 'Database administration tools',
  },
]

export function CollapsibleNavigation() {
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar } = useSidebar()
  const { user, isAuthenticated, isAdmin, logout, isLoading } = useAuth()

  return (
    <div
      className={`sticky top-0 left-0 h-screen bg-white border-r border-gray-200 flex flex-col z-40 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div
          className={`transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}
        >
          <h2 className="text-lg font-semibold whitespace-nowrap">DMS</h2>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0 z-10"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpenIcon className="h-5 w-5" />
          ) : (
            <PanelLeftCloseIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-4">
        {/* Main Navigation */}
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'hover:bg-gray-100 hover:text-gray-900'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Admin Navigation (only show for admins) */}
        {isAuthenticated && isAdmin && (
          <div>
            {!isCollapsed && (
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Admin
              </div>
            )}
            <ul className="space-y-2">
              {adminNavigationItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-orange-50 text-orange-700 border border-orange-200'
                          : 'hover:bg-gray-100 hover:text-gray-900'
                      } ${isCollapsed ? 'justify-center' : ''}`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {!isCollapsed && (
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                        </div>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t space-y-4">
        {/* User Info */}
        {isAuthenticated && user && (
          <div className={`transition-all duration-300 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-gray-500" />
              <div className="text-sm">
                <div className="font-medium">{user.name || user.email}</div>
                <div className="text-xs text-gray-500">{user.role}</div>
              </div>
            </div>
          </div>
        )}

        {/* Authentication Controls */}
        {isAuthenticated ? (
          <button
            onClick={logout}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-full hover:bg-gray-100 hover:text-gray-900 ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        ) : (
          <Link
            href="/login"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-full hover:bg-gray-100 hover:text-gray-900 ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={isCollapsed ? 'Login' : undefined}
          >
            <User className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && <span>Login</span>}
          </Link>
        )}

        {/* Version */}
        <div
          className={`text-xs text-gray-500 text-center transition-all duration-300 ${
            isCollapsed ? 'opacity-0' : 'opacity-100'
          }`}
        >
          DMS v1.0
        </div>
      </div>
    </div>
  )
}
