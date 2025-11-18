'use client'

import { useState, Suspense } from 'react'
import useSWR from 'swr'
import { KeyIcon, PlusIcon, TrashIcon, CopyIcon, ArrowLeftIcon, ClockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { swrConfig } from '@/lib/swr-config'
import { SWRConfig } from 'swr'
import Link from 'next/link'
import { generateApiKey, listApiKeys, revokeApiKey } from '@/lib/api'

function ApiKeysContent() {
  const [newKeyName, setNewKeyName] = useState<string>('')
  const [expirationDays, setExpirationDays] = useState<string>('1')
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [isGeneratingKey, setIsGeneratingKey] = useState<boolean>(false)
  const [isRevokingKey, setIsRevokingKey] = useState<string | null>(null)

  // Fetch API keys
  const { data: apiKeysData, mutate: mutateApiKeys } = useSWR('api-keys', listApiKeys, {
    revalidateOnFocus: false,
  })

  const handleGenerateApiKey = async () => {
    if (!newKeyName.trim()) return

    setIsGeneratingKey(true)
    try {
      const expiresIn = expirationDays === 'never' ? null : parseInt(expirationDays) * 24 * 60 * 60 // Convert days to seconds

      const response = await generateApiKey({
        keyName: newKeyName.trim(),
        expiresIn,
      })

      if (response.success) {
        setGeneratedKey(response.apiKey.key)
        setNewKeyName('')
        setExpirationDays('1')
        mutateApiKeys()
      }
    } catch (error) {
      console.error('Failed to generate API key:', error)
    } finally {
      setIsGeneratingKey(false)
    }
  }

  const handleRevokeApiKey = async (id: string) => {
    setIsRevokingKey(id)
    try {
      await revokeApiKey(id)
      mutateApiKeys()
    } catch (error) {
      console.error('Failed to revoke API key:', error)
    } finally {
      setIsRevokingKey(null)
    }
  }

  const handleCopyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        // Optional: You could add a toast notification here
        console.log('API key copied to clipboard')
      } else {
        // Fallback for browsers that don't support Clipboard API
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        console.log('API key copied to clipboard (fallback)')
      }
    } catch (error) {
      console.error('Failed to copy API key:', error)
      // Optional: Show error message to user
    }
  }

  const formatExpiration = (expiresAt: string | null): string => {
    if (!expiresAt) return 'Never expires'
    return new Date(expiresAt).toLocaleString()
  }

  const isKeyExpired = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const getExpirationStatus = (expiresAt: string | null): { text: string; color: string } => {
    if (!expiresAt) return { text: 'Active', color: 'text-green-600' }

    if (isKeyExpired(expiresAt)) {
      return { text: 'Expired', color: 'text-red-600' }
    }

    return { text: 'Active', color: 'text-green-600' }
  }

  return (
    <div className="pt-6 px-6">
      {/* Generated Key Dialog */}
      <Dialog open={!!generatedKey} onOpenChange={(open) => !open && setGeneratedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Your API key has been generated successfully. Copy it now as you won't be able to see
              it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-md border">
              <code className="text-sm break-all">{generatedKey}</code>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleCopyToClipboard(generatedKey || '')}
                className="flex items-center gap-2"
              >
                <CopyIcon className="h-4 w-4" />
                Copy Key
              </Button>
              <Button onClick={() => setGeneratedKey(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyIcon className="h-6 w-6" />
            API Key Management
          </h1>
          <p className="text-gray-600 mt-1">Generate and manage API keys for admin operations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left sidebar - Generate new key */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusIcon className="h-5 w-5" />
                Generate New Key
              </CardTitle>
              <CardDescription>Create a new API key with custom expiration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="key-name" className="block text-sm font-medium mb-1">
                  Key Name
                </label>
                <Input
                  id="key-name"
                  placeholder="Enter key name..."
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label htmlFor="expiration" className="block text-sm font-medium mb-1">
                  Expiration
                </label>
                <select
                  id="expiration"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-1"
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                  <option value="never">Never expires</option>
                </select>
              </div>

              <Button
                onClick={handleGenerateApiKey}
                disabled={isGeneratingKey || !newKeyName.trim()}
                className="w-full flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                {isGeneratingKey ? 'Generating...' : 'Generate Key'}
              </Button>
            </CardContent>
          </Card>

          {/* Usage Instructions */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Usage Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>• Use API keys for programmatic access to admin operations</p>
              <p>
                • Include the key in the header as:{' '}
                <code className="bg-gray-100 px-1 rounded">dms-key: YOUR_API_KEY</code>
              </p>
              <p>
                • Keys with expiration will automatically become invalid after the specified time
              </p>
              <p>• You can revoke keys at any time</p>
            </CardContent>
          </Card>
        </div>

        {/* Main content - API Keys List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyIcon className="h-5 w-5" />
                Existing API Keys
              </CardTitle>
              <CardDescription>
                {apiKeysData?.success
                  ? `${apiKeysData.apiKeys.length} keys found`
                  : 'Loading keys...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiKeysData && apiKeysData.success && apiKeysData.apiKeys.length > 0 ? (
                <div className="space-y-4">
                  {apiKeysData.apiKeys.map((apiKey) => {
                    const status = getExpirationStatus(apiKey.expiresAt)
                    const isExpired = isKeyExpired(apiKey.expiresAt)

                    return (
                      <div
                        key={apiKey.id}
                        className={`p-4 border rounded-lg ${
                          isExpired ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{apiKey.name}</h3>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${status.color} bg-opacity-10`}
                              >
                                {status.text}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">User:</span>
                                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    {apiKey.user.email}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Created:</span>
                                  <span>{new Date(apiKey.createdAt).toLocaleString()}</span>
                                </div>
                              </div>

                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <ClockIcon className="h-4 w-4" />
                                  <span className="font-medium">Expires:</span>
                                  <span>{formatExpiration(apiKey.expiresAt)}</span>
                                </div>
                                {isExpired && (
                                  <div className="text-red-600 text-xs flex items-center gap-1">
                                    This key has expired and is no longer valid
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRevokeApiKey(apiKey.id)}
                            disabled={isRevokingKey === apiKey.id}
                          >
                            <TrashIcon className="h-4 w-4" />
                            {isRevokingKey === apiKey.id ? 'Revoking...' : 'Revoke'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <KeyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys</h3>
                  <p className="text-gray-500">
                    Generate your first API key to get started with programmatic access
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function ApiKeysPage() {
  return (
    <SWRConfig value={swrConfig}>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 p-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <KeyIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Loading API Key Management...</p>
              </div>
            </div>
          </div>
        }
      >
        <ApiKeysContent />
      </Suspense>
    </SWRConfig>
  )
}
