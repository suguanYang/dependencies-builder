'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createAuthClient } from 'better-auth/react'

// Create the Better Auth client
const authClient = createAuthClient({
  basePath: '/api/auth',
})

export interface User {
  id: string
  email: string
  name?: string
  role?: string
  banned?: boolean
}

export interface Session {
  id: string
  expiresAt: Date
}

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  signup: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{ success: boolean; error?: string }>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user && !!session
  const isAdmin = user?.role === 'admin'

  const checkSession = useCallback(async () => {
    try {
      const sessionResponse = await authClient.getSession()
      if (sessionResponse.data) {
        setUser(sessionResponse.data.user)
        setSession(sessionResponse.data.session)
      }
    } catch (error) {
      console.error('Failed to get session:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Check for existing session on mount
  useEffect(() => {
    checkSession()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })

      if (result.data) {
        await checkSession()
        // Session will be handled by getSession call
        return { success: true }
      } else {
        return {
          success: false,
          error: result.error?.message || 'Login failed',
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Login failed',
      }
    }
  }

  const logout = async () => {
    try {
      await authClient.signOut()
      setUser(null)
      setSession(null)
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  const signup = async (email: string, password: string, name?: string) => {
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: name || '',
      })

      if (result.data) {
        await checkSession()

        // Session will be handled by getSession call
        return { success: true }
      } else {
        return {
          success: false,
          error: result.error?.message || 'Signup failed',
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Signup failed',
      }
    }
  }

  const refreshSession = async () => {
    try {
      const sessionResponse = await authClient.getSession()
      if (sessionResponse.data) {
        setUser(sessionResponse.data.user)
        setSession(sessionResponse.data.session)
      } else {
        setUser(null)
        setSession(null)
      }
    } catch (error) {
      console.error('Failed to refresh session:', error)
      setUser(null)
      setSession(null)
    }
  }

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    signup,
    refreshSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
