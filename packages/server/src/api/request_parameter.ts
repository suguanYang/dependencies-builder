// string to number
export const formatStringToNumber = <T extends Record<string, any>>(params: T) => {
  // validate first
  if (params.limit && isNaN(parseInt(params.limit))) {
    throw new Error('Limit must be a number')
  }
  if (params.offset && isNaN(parseInt(params.offset))) {
    throw new Error('Offset must be a number')
  }

  return {
    ...params,
    take: params.limit ? parseInt(params.limit) : 100,
    skip: params.offset ? parseInt(params.offset) : 0,
  }
}
