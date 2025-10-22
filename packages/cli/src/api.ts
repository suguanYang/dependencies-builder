const serverUrl = process.env.DMS_SERVER_URL || 'http://127.0.0.1:3001'
export const getProjectByName = async (name: string) => {

    try {
        const response = await fetch(`${serverUrl}//projects/name/${name}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`get project info failed : ${response.status} - ${errorText}`)
        }

        const project = await response.json() as { entries: { name: string; path: string }[]; type: "Lib" | "App" }

        return project;

    } catch (error) {
        throw error
    }

}