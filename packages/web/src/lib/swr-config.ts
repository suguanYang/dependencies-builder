import { SWRConfiguration } from 'swr'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://172.20.169.243:3001'

export const swrConfig: SWRConfiguration = {
  fetcher: (url: string) =>
    fetch(`${API_BASE}${url}`).then(async (res) => {
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      console.log('nodesData: ', data)

      return data
    }),

  onError: (error) => {
    console.error('SWR Error:', error)
  },

  revalidateOnFocus: false,
  revalidateOnReconnect: false,

  errorRetryCount: 3,
  errorRetryInterval: 5000,
}
