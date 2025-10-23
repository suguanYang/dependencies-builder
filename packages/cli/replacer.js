import defaultReplacer from 'tsc-alias/dist/replacers/default.replacer.js'

const anyQuote = `["']`
const pathStringContent = `[^"'\r\n]+`
const importString = `(?:${anyQuote}${pathStringContent}${anyQuote})`

const funcStyle = new RegExp(
  `(?:\\b(?:import|require)\\s*\\(\\s*(\\/\\*.*\\*\\/\\s*)?${importString}\\s*\\))`,
)

export default (arg) => {
  const res = funcStyle.exec(arg.orig)
  if (res && res[1]) {
    arg.orig = arg.orig.replace(res[1], '')
    return defaultReplacer.default(arg)
  }

  return arg.orig
}
