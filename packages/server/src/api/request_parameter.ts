// string to number
export const formatStringToNumber = (params: Record<string, any>) => {
    // validate first
    if (params.limit && isNaN(parseInt(params.limit))) {
        throw new Error('Limit must be a number')
    }
    if (params.offset && isNaN(parseInt(params.offset))) {
        throw new Error('Offset must be a number')
    }

    return {
        ...params,
        limit: params.limit ? parseInt(params.limit) : 100,
        offset: params.offset ? parseInt(params.offset) : 0,
    }
}