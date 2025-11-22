'use client'

import React, { useState } from 'react'
import { TrashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteConfirmationModal } from '@/components/delete-confirmation-modal'

interface DeleteButtonProps {
  /** The item to be deleted (used for confirmation message) */
  item: any
  /** Function to get the display name for the confirmation message */
  getDisplayName?: (item: any) => string
  /** Function to perform the actual deletion */
  onDelete: (item: any) => Promise<void>
  /** Function to refresh data after deletion */
  onSuccess?: () => void
  /** Optional title for the confirmation modal */
  title?: string
  /** Optional description template for the confirmation modal */
  description?: string
  /** Whether the button should be disabled */
  disabled?: boolean
  /** Size of the button */
  size?: 'sm' | 'default' | 'lg'
  /** Button variant */
  variant?: 'destructive' | 'outline' | 'ghost'
  /** Additional CSS classes */
  className?: string
}

export function DeleteButton({
  item,
  getDisplayName = (item) => item.name || item.id || 'this item',
  onDelete,
  onSuccess,
  title = 'Confirm Delete',
  description = `Are you sure you want to delete "{name}"? This action cannot be undone.`,
  disabled = false,
  size = 'sm',
  variant = 'destructive',
  className,
}: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleDeleteClick = () => {
    setShowConfirmation(true)
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(item)
      setShowConfirmation(false)
      onSuccess?.()
    } catch (error) {
      // Error handling should be done by the parent component
      console.error('Failed to delete item:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const displayName = getDisplayName(item)
  const formattedDescription = description.replace('{name}', displayName)

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleDeleteClick}
        disabled={disabled || isDeleting}
        className={className}
        title="Delete"
      >
        <TrashIcon className="h-4 w-4" />
      </Button>

      <DeleteConfirmationModal
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        title={title}
        description={formattedDescription}
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
