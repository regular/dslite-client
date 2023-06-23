const {client} = require('websocket')
const util = require('util')
const DS = require('../dslite-proxy')
const proxyConfig = require('rc')('dslite-proxy')
const formatEvent = require('../dslite-proxy/format-events')

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
    const eventPromises = []
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
          if (event) {
            eventPromises.forEach( ({reject, resolve, filters}) =>{
              if (filters.bad && filters.bad(j)) reject(new Error("received bad event: " + formatEvent(j) ))
              if (filters.good && filters.good(j)) resolve(j)
            })
          }
          if (cbs[error]) {
            const err = new Error(j.data.message)
            cbs[error](err)
            delete cbs[error]
          } 
          if (cbs[response]) {
            cbs[response](null, data)
            delete cbs[response]
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
            cb(null, fromEntries(api))
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

    function enrichApi(api) {
      api.waitForEvent = function (filters) {
        return new Promise((resolve, reject)=>{
          const {good, bad, timeout} = filters
          if (timeout) setTimeout( ()=>reject(new Error(`timeout of ${timeout} ms while waiting for event`)), timeout)
          eventPromises.push({filters: filters, reject, resolve})
        })
      }
      return api
    }

    function fromEntries(entries) {
      const ret = {}
      for(const [path, x] of entries) {
        insert(ret, path.split('.'), x)
      }
      return enrichApi(ret)

      function insert(o, path, x) {
        const [p, ...rest] = path
        if (rest.length == 0) {
          o[p] = x
        } else {
          o[p] = o[p] || {}
          insert(o[p], rest, x)
        }
      }
    }
  }
}
