'use client'

import React from 'react'
import { XIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useErrorStore } from '@/hooks/use-error-store'

export function GlobalErrorDisplay() {
  const { errors, removeError } = useErrorStore()

  if (errors.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {errors.map((error) => (
        <Alert key={error.id} variant="destructive" className="shadow-lg">
          <div className="flex items-start justify-between">
            <AlertDescription className="flex-1 pr-4">
              {error.message}
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive/20"
              onClick={() => removeError(error.id)}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  )
}