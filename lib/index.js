import { createRequire } from "module";
const require = createRequire(import.meta.url);


// camelCased transform into
//
export const camelCased = (str) =>
    str
    .toLowerCase()
    .replace(
        /(?:^\w|[A-Z]|\b\w|\s+)/g,
        (match, index) =>
            (+match === 0) ? '' :
            (index === 0) ? match.toLowerCase()
            : match.toUpperCase()
    )


// getExpressApp
//
const express = require('express')
export const getExpressApp =  () => {
    const app = express()
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))
    return app
}


// getFreePort
//
const net = require('net')
export const getFreePort =  () => {
    let svr = net.createServer((s) => {})
    return new Promise ((ok) => {
        svr.listen(0, () => {
            let p = svr.address().port
            svr.close(() => ok(p))
        })
    })
}


// packWords removes with-spaces into a space
//
export const packWords = (s) => s.replace(/\s+/g, ' ').trim()



// parseRows parses row into array of bject
//
export const parseRows = (str, COLUMNS) => {
    let lines = str.split('\n').filter(Boolean)
    let header = lines[0]
    let columns = COLUMNS
        .map(k => ({
            key: camelCased(k),
            start: header.indexOf(k),
            length: undefined
        }))
        .map( (a, i, arr) => {
            let b = arr[i+1]
            if (!b) return a

            a.length = b.start - a.start
            return a
        })

    return lines
        .slice(1)
        .map(s => {
            let a = {}
            columns.forEach(k => {
                let n = k.key
                a[n] = s.substr(k.start, k.length).trim()
            })
            return a
        })
}

// spawn
//

export const spawn = require('child_process').spawn