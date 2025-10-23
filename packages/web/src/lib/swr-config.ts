import { SWRConfiguration } from 'swr'
import { apiRequest } from './api'

export const swrConfig: SWRConfiguration = {
  fetcher: (url: string) => apiRequest(url),

  onError: (error) => {
    console.error('SWR Error:', error)
  },

  revalidateOnFocus: false,
  revalidateOnReconnect: false,

  errorRetryCount: 3,
  errorRetryInterval: 5000,
}
