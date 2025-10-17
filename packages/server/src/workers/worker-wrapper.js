import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workerData } from 'node:worker_threads';

import { createServer } from 'vite'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { installSourcemapsSupport } from 'vite-node/source-map'

// create vite server
const server = await createServer({
    optimizeDeps: {
        // It's recommended to disable deps optimization
        noDiscovery: true,
        include: undefined,
    },
    server: {
        port: 21333,
    },
})

// create vite-node server
const node = new ViteNodeServer(server)

// fixes stacktraces in Errors
installSourcemapsSupport({
    getSourceMap: source => node.getSourceMap(source),
})

// create vite-node runner
const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    // when having the server and runner in a different context,
    // you will need to handle the communication between them
    // and pass to this function
    fetchModule(id) {
        return node.fetchModule(id)
    },
    resolveId(id, importer) {
        return node.resolveId(id, importer)
    },
})


const mod = await runner.executeFile(workerData.fullpath)

export default mod.default