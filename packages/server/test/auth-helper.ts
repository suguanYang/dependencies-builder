import { FastifyInstance } from 'fastify'
import { prisma } from '../src/database/prisma'

export async function getAuthHeaders(server: FastifyInstance, role: 'user' | 'admin' = 'user') {
  const email = `test-${Date.now()}-${Math.random()}@example.com`
  const password = 'password123'
  const name = 'Test User'

  // Sign up
  const signUpRes = await server.inject({
    method: 'POST',
    url: '/auth/sign-up/email',
    payload: {
      email,
      password,
      name,
    },
  })

  if (signUpRes.statusCode !== 200) {
    console.error('Sign up failed:', signUpRes.body)
    throw new Error('Failed to sign up')
  }

  // Sign in
  const signInRes = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email',
    payload: {
      email,
      password,
    },
  })

  if (signInRes.statusCode !== 200) {
    console.error('Sign in failed:', signInRes.body)
    throw new Error('Failed to sign in')
  }

  const cookies = signInRes.headers['set-cookie']
  if (!cookies) {
    throw new Error('No cookies returned from sign in')
  }

  // If admin role is requested, update the user role directly in DB
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error('User not found')

  if (role === 'admin') {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'admin' },
    })
  }

  return {
    headers: {
      Cookie: cookies,
    },
    user,
  }
}
