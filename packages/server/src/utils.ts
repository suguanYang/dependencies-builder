export const queryContains = (query: Record<string, any>, fields: string[]) => {
  for (const field of fields) {
    if (query[field]) {
      query[field] = {
        contains: query[field],
      }
    }
  }
}

export const onlyQuery = <T extends Record<string, any>, F extends keyof T>(
  query: T,
  fields: F[],
) => {
  const newQuery: Pick<T, F> = {} as any

  for (const field of fields) {
    newQuery[field] = query[field]
  }

  return newQuery
}
