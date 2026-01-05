'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import { getLLMConfig, updateLLMConfig } from '@/lib/api'
import { useErrorStore } from '@/hooks/use-error-store'
import { SettingsIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { LLMConfig } from '@/lib/server-types'

export default function LLMConfigPage() {
  const [config, setConfig] = useState<LLMConfig>({
    apiKey: '',
    baseUrl: '',
    modelName: '',
    temperature: 0.7,
    enabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const errorStore = useErrorStore()

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      const data = await getLLMConfig()
      setConfig(data)
    } catch (error) {
      // Error handled by apiRequest/errorStore mainly, but we can log
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
      await updateLLMConfig(config)
      setMessage('Configuration saved successfully')
    } catch (error) {
      // Error store handles it
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              ← Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            LLM Configuration
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LLM Settings</CardTitle>
          <CardDescription>
            Configure the Language Model provider settings for the agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field>
              <FieldLabel>Enable LLM Integration</FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                />
                <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                  Enable
                </label>
              </div>
              <FieldDescription>Toggle the LLM usage for the entire system.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>API Key</FieldLabel>
              <Input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="sk-..."
                required={config.enabled}
              />
              <FieldDescription>Your OpenAI (or compatible) API Key.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Base URL</FieldLabel>
              <Input
                type="text"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
              <FieldDescription>
                The base URL for the API. Use standard OpenAI URL or a local proxy like Ollama.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Model Name</FieldLabel>
              <Input
                type="text"
                value={config.modelName}
                onChange={(e) => setConfig({ ...config, modelName: e.target.value })}
                placeholder="gpt-4"
              />
              <FieldDescription>
                The model identifier to use (e.g., gpt-4, gpt-3.5-turbo, etc.).
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Temperature</FieldLabel>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              />
              <FieldDescription>
                Sampling temperature (0 to 2). Higher values mean more random outputs.
              </FieldDescription>
            </Field>

            {message && (
              <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">{message}</div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
