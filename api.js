const {client} = require('websocket')
const util = require('util')
const DS = require('../dslite-proxy')
const proxyConfig = require('rc')('dslite-proxy')

module.exports = function getApi(opts, cb) {
  opts = opts || {}
  const log = opts.log || (()=>{})
  const endpoints = {}

  const ret = new Promise( (resolve, reject)=>{
    DS(log, proxyConfig, {onNewEndpoint}, err=>{
      if (err) return reject(err)
      newEndpoint(proxyConfig.port, null, (err, api)=>{
        if (err) return reject(err)
        resolve(api)
      })
    })
  })
  if (cb) {
    ret.then(api=>cb(null, api)).error(err=>cb(err))
  }
  return ret


  function onNewEndpoint(name, port, subProtocol, cb) {
    log('NEW', name, port, subProtocol)
    newEndpoint(port, subProtocol, (err, api)=>{
      if (err) {
        consoleo.error(err)
        return cb(err)
      }
      endpoints[port] = api
      cb(null, {newEndpoint: port})
    })
  }

  function newEndpoint(port, subProtocol, cb) {
    const c = new client()
    c.on('connectFailed', err => {
      log('connect to server failed:', err.message)
      cb(err)
    })

    c.on('connect', (conn) => {
      log(`Connected to ${port} ${subProtocol}`)
      makeAPI(conn, cb)
    })

    const serverUrl = `ws://127.0.0.1:${port}/`
    log("connecting to server: ", serverUrl)
    c.connect(serverUrl, subProtocol)
  }

  function makeAPI(conn, cb) {
    let api
    let id = 1
    const cbs = {}
    conn.on('message', msg => {
      if (msg.type === 'utf8') {
        let j = JSON.parse(msg.utf8Data)
        let {response, data, error,  event} = j
        if (j.newEndpoint) {
          data = endpoints[j.newEndpoint]
          delete endpoints[j.newEndpoint]
        }
        if (cbs[response]) {
          if (error) {
            const err = new Error(j.data.message)
            err.code = j.error
            cbs[response](err)
          } else {
            cbs[response](null, data)
          }
        } else if (response == 1) {
          const decorate = opts.promisify ? util.promisify : (x=>x)
          const api = data.commands.map(command=>{
            return [command, decorate(function() {
              id++
              const args = Array.from(arguments)
              const cb = args.pop()
              cbs[id] = cb
              conn.sendUTF(JSON.stringify({
                command,
                id,
                data: args
              }))
            })]
          })
          cb(null, Object.fromEntries(api))
        }
      } else if (msg.type === 'binary') {
        log('binary message from server', {binaryLength: msg.binaryData.length})
      } else log('unknown message type from dslite', msg.type)
    })
    conn.sendUTF(JSON.stringify({
      "command":"listCommands",
      "id": id++,
      "data":[]
    }))
  }
}
