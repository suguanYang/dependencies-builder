import { optimizedAutoCreateConnections } from './create-connections'

export default async function run() {
  try {
    const result = await optimizedAutoCreateConnections()
    return {
      success: true,
      ...result,
    }
  } catch (err) {
    return {
      success: false,
      createdConnections: 0,
      skippedConnections: 0,
      errors: [err instanceof Error ? err.message : String(err)],
    }
  }
}
