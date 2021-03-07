// node-docker-runner
// lists, run, stop docker instances via http-call
//
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require('dotenv').config()

import {
    getExpressApp,
    packWords,
    parseRows,
    spawn,
} from './lib/index.js'


const app = getExpressApp()
app.post('/hello', async (_, res) => {
    res.json({
        data: {
            hello: 'node-docker-runner',
            port: server.address().port
        }
    })
})
app.post('/list', async (_, res) => {
    res.json({ data: await dockerList()})
})
app.post('/stop', async (req,res) => {
    let error = await dockerStop(req.body.data)
        ? null
        : 'not found'
    res.json({
        error,
        data: await dockerList()
    })
})
app.post('/run', (req,res) => {
    setTimeout(async () => dockerRun(req.body.data))
    res.json({})
})

var argv = require('yargs/yargs')(process.argv.slice(2)).argv
const port = argv.port || process.env.NODE_DOCKER_RUNNER_PORT || 3002
const server = app.listen(port, () => {
    console.log(`node-docker-runner at ${port}`)
})


// spawns docker ps
//
//
const dockerList= async () => {
    let opts = {
        stdio: [
            'ignore',
            'pipe',
            'ignore'
        ]
    }
    let cp = spawn('docker', ['ps'], opts)

    let str = []
    cp.stdout.on('data', (data) => str.push(`${data}`))

    return new Promise((ok) => {
        cp.on('close', () => {
            let rs = parseRows(str.join(''), DOCKER_LIST_COLUMNS)
            ok(rs)
        })
    })

}

const DOCKER_LIST_COLUMNS = [
    'CONTAINER ID',
    'IMAGE',
    'COMMAND',
    'CREATED',
    'STATUS',
    'PORTS',
    'NAMES'
]

// checks if a dapr-app exists
//
//
const dockerHasInstance = async ({names}) =>
    (await dockerList())
    .filter(a => a.names === names)
    .length > 0


// spawns docker stop
//
//
const dockerStop = async ({
    names,
} = {}) => {
    if (!await dockerHasInstance({names})) {
        return false
    }

    console.log(`stop ${names}`)

    let args = [
        'stop',
        names
    ]
    let opts = {
        stdio: ['ignore', 'ignore', 'ignore']
    }
    let cp = spawn('docker', args, opts)

    return new Promise((ok) => {
        cp.unref()
        cp.on('close', () => ok(true))
    })

}

// spawns docker run
//
//
const dockerRun = async ({
    names,
    image,

    remove = true, // --rm
    detach = true, // -d

    ports = [], // local-port:docker-port
    volumes = [], // local-path:docker-path
    envs = [], // key=value


    command = '', // additional command to run
    args = [], // arguments after

    logLevel = 'error', // debug, info, warn, error, fatal, panic
    debug = false,
    exists = 'skip', // stop, skip

    onOutput,
    onError,
    onClose,
} = {}) => {
    if (!names || !image) {
        console.log(`run ${names}: missing names/image`)
        return
    }

    if (await dockerHasInstance({names})) {
        if (exists === 'stop') {
            await dockerStop({appIdnames})
        }
        else if (exists === 'skip') {
            console.log(`skip ${names}`)
            return
        }
    }

    logLevel = debug ? 'debug' : (logLevel || 'error')
    onOutput = onOutput || debug && ((a) => console.log(`${a}`))
    onError = onError || debug && ((a) => console.log(`${a}`))
    onClose = onClose || debug && ((a) => console.log(`${names} closed with code ${a}`))

    let argv = [
        'run',
        '--name', names
    ]
    .concat(remove ? ['--rm']: [])
    .concat(detach ? ['--detach']: [])
    .concat(command ? packWords(`${command}`).split(' ') : [])
    .concat(ports.flatMap(a => ['--publish', a]))
    .concat(volumes.flatMap(a => ['--volume', a]))
    .concat(envs.flatMap(a => ['--env', a]))
    .concat([image])
    .concat(command ? packWords(`-- ${command}`).split(' ') : [])
    .concat(args.flatMap(a => a))

    console.log(`run ${names}: docker ${argv.join(' ')}`)

    let opts = {
        detached: true,
        windowsHide: true,
        stdio: [
            'ignore',
            onOutput ? 'pipe' : 'ignore',
            onError ? 'pipe' : 'ignore',
        ]
    }

    let cp = spawn('docker', argv, opts)
    if (onOutput) cp.stdout.on('data', onOutput)
    if (onError) cp.stderr.on('data', onError)
    if (onClose) cp.on('close', onClose)
    cp.unref()
}
