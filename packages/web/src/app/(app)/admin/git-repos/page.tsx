'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { getGitRepos, createGitRepo, updateGitRepo, deleteGitRepo } from '@/lib/api'
import { useErrorStore } from '@/hooks/use-error-store'
import { ServerIcon, Loader2, Plus, Trash2, Edit2, X } from 'lucide-react'
import Link from 'next/link'
import { GitRepo } from '@/lib/server-types'

export default function GitReposPage() {
  const [repos, setRepos] = useState<GitRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState<Partial<GitRepo>>({
    name: '',
    host: '',
    apiUrl: '',
    accessToken: '',
    enabled: true,
  })
  const errorStore = useErrorStore()

  useEffect(() => {
    loadRepos()
  }, [])

  async function loadRepos() {
    try {
      setLoading(true)
      const response = await getGitRepos()
      setRepos(response.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSaving(true)
      setMessage(null)

      if (editingId) {
        // Update existing
        await updateGitRepo(editingId, formData)
        setMessage('GitRepo updated successfully')
        setEditingId(null)
      } else {
        // Create new
        await createGitRepo(formData as Omit<GitRepo, 'id' | 'createdAt' | 'updatedAt'>)
        setMessage('GitRepo created successfully')
        setShowCreateForm(false)
      }

      // Reset form
      setFormData({
        name: '',
        host: '',
        apiUrl: '',
        accessToken: '',
        enabled: true,
      })

      // Reload list
      await loadRepos()
    } catch (error) {
      // Error store handles it
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this GitRepo configuration?')) {
      return
    }

    try {
      setSaving(true)
      await deleteGitRepo(id)
      setMessage('GitRepo deleted successfully')
      await loadRepos()
    } catch (error) {
      // Error store handles it
    } finally {
      setSaving(false)
    }
  }

  function startEdit(repo: GitRepo) {
    setFormData({
      name: repo.name,
      host: repo.host,
      apiUrl: repo.apiUrl,
      accessToken: repo.accessToken,
      enabled: repo.enabled,
    })
    setEditingId(repo.id)
    setShowCreateForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setShowCreateForm(false)
    setFormData({
      name: '',
      host: '',
      apiUrl: '',
      accessToken: '',
      enabled: true,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              ← Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ServerIcon className="h-6 w-6" />
            GitLab Repositories
          </h1>
        </div>
        {!showCreateForm && !editingId && (
          <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add GitRepo
          </Button>
        )}
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">{message}</div>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || editingId) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit GitRepo' : 'Create GitRepo'}</CardTitle>
            <CardDescription>
              Configure a GitLab host. One configuration serves all repositories on the same host.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field>
                <FieldLabel>Name</FieldLabel>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My GitLab Instance"
                  required
                />
                <FieldDescription>A friendly name for this GitLab instance.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Host</FieldLabel>
                <Input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="gitlab.com or code.example.com"
                  required
                />
                <FieldDescription>
                  The hostname of the GitLab instance (e.g., gitlab.com, code.repo.com).
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>API URL</FieldLabel>
                <Input
                  type="text"
                  value={formData.apiUrl}
                  onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                  placeholder="https://gitlab.com/api/v4"
                  required
                />
                <FieldDescription>
                  The full API URL including /api/v4 (e.g., https://code.repo.com/api/v4).
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Access Token</FieldLabel>
                <Input
                  type="password"
                  value={formData.accessToken}
                  onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                  placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                  required
                />
                <FieldDescription>
                  GitLab personal access token with API access permissions.
                </FieldDescription>
              </Field>

              <Field>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enabled"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                  <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                    Enabled
                  </label>
                </div>
                <FieldDescription>
                  Enable or disable this GitLab instance configuration.
                </FieldDescription>
              </Field>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingId ? (
                    'Update'
                  ) : (
                    'Create'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List of GitRepos */}
      <Card>
        <CardHeader>
          <CardTitle>Configured GitLab Hosts</CardTitle>
          <CardDescription>
            Manage GitLab instance configurations. Each host configuration serves all repositories
            on that host.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {repos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No GitLab hosts configured. Click "Add GitRepo" to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  className="border rounded-lg p-4 flex items-start justify-between hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{repo.name}</h3>
                      {!repo.enabled && (
                        <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>
                        <span className="font-medium">Host:</span> {repo.host}
                      </div>
                      <div>
                        <span className="font-medium">API URL:</span> {repo.apiUrl}
                      </div>
                      <div className="text-xs text-gray-400">
                        Created: {new Date(repo.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(repo)}
                      disabled={saving || editingId === repo.id}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(repo.id)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
