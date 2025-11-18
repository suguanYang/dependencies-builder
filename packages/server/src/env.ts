if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

if (!process.env.ADMIN_USER_EMAIL) {
  throw new Error('ADMIN_USER_EMAIL is not set')
}

export const DATABASE_URL = process.env.DATABASE_URL
export const ADMIN_USER_EMAIL = process.env.ADMIN_USER_EMAIL
