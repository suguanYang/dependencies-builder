import Debugger from 'debug'

export const error = Debugger('error')
error.log = console.error.bind(console)
Debugger.enable('error')

const debug = Debugger('debug')
debug.log = console.log.bind(console)

export const enable = () => Debugger.enable('debug')

export default debug

export const enabled = () => Debugger.enabled('debug')
