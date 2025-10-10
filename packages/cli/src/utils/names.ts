const projectNameToCodeQLName = (name: string) => {
    return name.toLowerCase().replace('@', '').replaceAll('/', '-')
}

export { projectNameToCodeQLName }