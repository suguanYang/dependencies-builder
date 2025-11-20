'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NodeIdInputProps {
  value?: string
  onValueChange: (nodeId: string | undefined) => void
  placeholder?: string
  className?: string
}

export function NodeIdInput({
  value,
  onValueChange,
  placeholder = 'Enter node ID...',
  className,
}: NodeIdInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.trim()
    onValueChange(newValue || undefined)
  }

  return (
    <div className={className}>
      <Label htmlFor="node-id-input" className="sr-only">
        Node ID
      </Label>
      <Input
        id="node-id-input"
        type="text"
        value={value || ''}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full"
      />
    </div>
  )
}