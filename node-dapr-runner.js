// node-dapr-runner
// lists, run, stop dapr instances via http-call
//
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require('dotenv').config()

import {
    getExpressApp,
    getFreePort,
    packWords,
    parseRows,
    spawn,
} from './lib/index.js'


const app = getExpressApp()
app.post('/list', async (_, res) => {
    res.json({ data: await daprList()})
})
app.post('/stop', async (req,res) => {
    let error = await daprStop(req.body.data)
        ? null
        : 'not found'
    res.json({
        error,
        data: await daprList()
    })
})
app.post('/run', (req,res) => {
    setTimeout(() => daprRun(req.body.data))
    res.json({})
})
const svr = app.listen(0, async () => {
    let appPort = svr.address().port // random port used

    let daprApps = await daprList()
    let daprHttpPort = process.env.DAPR_HTTP_PORT || 3500
    let daprPortTaken = daprApps.filter(a => a.httpPort === daprHttpPort).length>0

    await daprRun({
        appId: 'node-dapr-runner',
        appPort,
        ...(!daprPortTaken && {daprHttpPort}),
    })

    console.log(`node-dapr-runner at ${appPort}`)

})


// spawns dapr list
//
//
const daprList = async () => {
    let opts = {
        stdio: [
            'ignore',
            'pipe',
            'ignore'
        ]
    }
    let cp = spawn('dapr', ['list'], opts)

    let str = []
    cp.stdout.on('data', (data) => str.push(`${data}`))

    return new Promise((ok) => {
        cp.on('close', () => {
            let rs = parseRows(str.join(''), DAPR_LIST_COLUMNS)
            ok(rs)
        })
    })

}

const DAPR_LIST_COLUMNS = [
    'APP ID',
    'HTTP PORT',
    'GRPC PORT',
    'APP PORT',
    'COMMAND',
    'AGE',
    'CREATED',
    'PID'
]


// checks if a dapr-app exists
//
//
const daprHasInstance = async ({appId}) =>
    (await daprList())
    .filter(a => a.appId === appId)
    .length > 0


// spawns dapr stop
//
//
const daprStop = async ({
    appId,
} = {}) => {
    if (!await daprHasInstance({appId})) {
        return false
    }

    console.log(`stop ${appId}`)

    let args = [
        'stop',
        '--app-id', appId,
    ]
    let opts = {
        stdio: ['ignore', 'ignore', 'ignore']
    }
    let cp = spawn('dapr', args, opts)

    return new Promise((ok) => {
        cp.unref()
        cp.on('close', () => ok(true))

    })

}


// spawns dapr run
// if run with nodemon, dapr-run processes will be bound
//
const daprRun = async ({
    appId,
    appPort = -1,
    command = '',
    logLevel = 'error', // debug, info, warn, error, fatal, panic
    debug = false,
    exists = 'skip', // stop, skip

    daprHttpPort = -1,
    daprGrpcPort = -1,
    onOutput,
    onError,
    onClose,
} = {}) => {
    if (!appId) {
        console.log(`run ${appId}: missing appId`)
        return
    }

    if (appPort===0 && command) {
        appPort = await getFreePort()
        command = `${command} --port ${appPort}`
    }

    if (!appPort) {
        console.log(`run ${appId}: missing appPort`)
        return
    }

    if (await daprHasInstance({appId})) {
        if (exists === 'stop') {
            await daprStop({appId})
        }
        else if (exists === 'skip') {
            console.log(`skip ${appId}`)
            return
        }
    }


    logLevel = debug ? 'debug' : (logLevel || 'error')
    onOutput = onOutput || debug && ((a) => console.log(`${a}`))
    onError = onError || debug && ((a) => console.log(`${a}`))
    onClose = onClose || debug && ((a) => console.log(`${appId} closed with code ${a}`))

    let argv = [
        'run',
        '--app-id', appId
    ]
    .concat(logLevel ? ['--log-level', logLevel] : [])
    .concat(appPort ? ['--app-port', appPort] : [])
    .concat(daprHttpPort ? ['--dapr-http-port', daprHttpPort] : [])
    .concat(daprGrpcPort ? ['--dapr-grpc-port', daprGrpcPort] : [])
    .concat(command ? packWords(`-- ${command}`).split(' ') : [])

    console.log(`run ${appId}: dapr ${argv.join(' ')}`)

    let opts = {
        detached: true,
        windowsHide: true,
        shell: true,
        stdio: [
            'ignore',
            onOutput ? 'pipe' : 'ignore',
            onError ? 'pipe' : 'ignore'
        ]
    }


    let cp = spawn('dapr', argv, opts)
    if (onOutput) cp.stdout.on('data', onOutput)
    if (onError) cp.stderr.on('data', onError)
    if (onClose) cp.on('close', onClose)

    cp.unref()
}
