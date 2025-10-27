import { useState, useEffect } from 'react'
import { errorStore } from '@/lib/error-store'

interface NetworkError {
  id: string
  message: string
  timestamp: Date
  type?: 'network' | 'api' | 'auth'
}

export function useErrorStore() {
  const [errors, setErrors] = useState<NetworkError[]>([])

  useEffect(() => {
    // Subscribe to the external store
    const unsubscribe = errorStore.subscribe((currentErrors) => {
      setErrors(currentErrors)
    })

    // Cleanup subscription on unmount
    return unsubscribe
  }, [])

  const removeError = (id: string) => {
    errorStore.removeError(id)
  }

  const clearErrors = () => {
    errorStore.clearErrors()
  }

  const addError = (message: string, type: 'network' | 'api' | 'auth' = 'network') => {
    errorStore.addError(message, type)
  }

  return {
    errors,
    removeError,
    clearErrors,
    addError,
  }
}