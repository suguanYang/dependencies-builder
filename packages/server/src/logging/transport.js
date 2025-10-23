import pretty from 'pino-pretty'

export default async (options) => {
  return pretty({
    colorize: false,
    destination: options.destination,
    append: true,
    minimumLevel: options.level,
  })
}
