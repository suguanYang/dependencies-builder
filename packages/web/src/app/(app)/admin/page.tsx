'use client'

import React, { Suspense } from 'react'
import { DatabaseIcon, SettingsIcon, UsersIcon, KeyIcon, ShieldIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

function AdminContent() {
  const adminFeatures = [
    {
      title: 'Database Admin',
      description: 'Execute raw SQL queries and explore database schema',
      icon: DatabaseIcon,
      href: '/admin/database',
      color: 'bg-blue-50 text-blue-600'
    },
    {
      title: 'API Key Management',
      description: 'Generate and manage API keys for admin operations',
      icon: KeyIcon,
      href: '/admin/api-keys',
      color: 'bg-green-50 text-green-600'
    },
    {
      title: 'User Management',
      description: 'Manage user accounts and permissions',
      icon: UsersIcon,
      href: '#',
      color: 'bg-purple-50 text-purple-600',
      disabled: true
    },
    {
      title: 'System Settings',
      description: 'Configure system-wide settings and preferences',
      icon: SettingsIcon,
      href: '#',
      color: 'bg-orange-50 text-orange-600',
      disabled: true
    },
    {
      title: 'Security & Audit',
      description: 'View security logs and audit trails',
      icon: ShieldIcon,
      href: '#',
      color: 'bg-red-50 text-red-600',
      disabled: true
    }
  ]

  return (
    <div className="pt-6 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldIcon className="h-8 w-8" />
          Admin Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Manage system administration tasks and monitor application health
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminFeatures.map((feature) => (
          <Card
            key={feature.title}
            className={`transition-all hover:shadow-md ${
              feature.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-gray-300'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <div className={`p-2 rounded-lg ${feature.color}`}>
                  <feature.icon className="h-5 w-5" />
                </div>
              </div>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {feature.disabled ? (
                <Button variant="outline" disabled className="w-full">
                  Coming Soon
                </Button>
              ) : (
                <Link href={feature.href} className="block">
                  <Button variant="default" className="w-full">
                    Access
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">Quick Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-gray-500">Currently online</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Database Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-gray-500">Total storage used</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-gray-500">Active keys</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">-</div>
              <p className="text-xs text-gray-500">All systems operational</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <ShieldIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Loading Admin Dashboard...</p>
          </div>
        </div>
      </div>
    }>
      <AdminContent />
    </Suspense>
  )
}