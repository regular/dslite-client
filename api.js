const {client} = require('websocket')
const DS = require('../dslite-proxy')
const proxyConfig = require('rc')('dslite-proxy')

module.exports = function getApi(log, cb) {
  DS(log, proxyConfig, err=>{
    if (err) return cb(err)

    const c = new client()
    c.on('connectFailed', err => {
      log('connect to server failed:', err.message)
    })

    c.on('connect', (conn) => {
      log("Connected to server")
      makeAPI(conn, cb)
    })

    const serverUrl = `ws://localhost:${proxyConfig.port}/`
    log("connecting to server: ", serverUrl)
    c.connect(serverUrl, null);
  })

  function makeAPI(conn, cb) {
    let api
    let id = 1
    const cbs = {}
    conn.on('message', msg => {
      if (msg.type === 'utf8') {
        let j = JSON.parse(msg.utf8Data)
        const {response, data, event} = j
        if (cbs[response]) {
          // TODO: how do errors look?
          cbs[response](null, data)
        } else if (response == 1) {
          const api = data.commands.map(command=>{
            return [command, function() {
              id++
              const args = Array.from(arguments)
              const cb = args.pop()
              cbs[id] = cb
              conn.sendUTF(JSON.stringify({
                command,
                id,
                data: args
              }))

            }]
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
