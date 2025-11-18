// External store for global error handling

interface NetworkError {
  id: string
  message: string
  timestamp: Date
  type?: 'network' | 'api' | 'auth'
}

type Listener = (errors: NetworkError[]) => void

class ErrorStore {
  private errors: NetworkError[] = []
  private listeners: Listener[] = []

  addError(message: string, type: 'network' | 'api' | 'auth' = 'network') {
    const error: NetworkError = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      timestamp: new Date(),
      type,
    }

    this.errors.push(error)
    this.notifyListeners()

    // Auto-remove error after 8 seconds
    setTimeout(() => {
      this.removeError(error.id)
    }, 30000)
  }

  removeError(id: string) {
    this.errors = this.errors.filter((error) => error.id !== id)
    this.notifyListeners()
  }

  clearErrors() {
    this.errors = []
    this.notifyListeners()
  }

  getErrors(): NetworkError[] {
    return [...this.errors]
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener)

    // Call listener immediately with current state
    listener(this.errors)

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notifyListeners() {
    const currentErrors = this.getErrors()
    this.listeners.forEach((listener) => {
      listener(currentErrors)
    })
  }
}

// Create singleton instance
export const errorStore = new ErrorStore()
