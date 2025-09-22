export const isCI = () => {
    return process.env.CI === 'true'
}