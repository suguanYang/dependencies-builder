export const queryContains = (query: Record<string, string>, fields: string[]) => {
  for (const field of fields) {
    if (query[field]) {
      query[field] = {
        contains: query[field],
      }
    }
  }
}
