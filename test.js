const DSProxy = require('dslite-proxy')
const proxyConfig = require('rc')('dslite-proxy')
const client = require('.')

const log = proxyConfig.verbose ?  console.log : ()=>{}

async function main() {
  console.log(proxyConfig)
  const proxy = await startServer(proxyConfig, {log})
  console.log('proxy started')
  const ds = await client(proxy.port, {log, promisify: true})
  console.log(await ds.getVersion())
  await ds.close()
  proxy.stop()
}

main()

function startServer(config, opts) {
  opts = opts || {}
  const log = opts.log || ( ()=>{} )
  return new Promise( (resolve, reject)=>{
    DSProxy(log, config, {}, (err, res)=>{
      if (err) return reject(err)
      resolve(res)
    })
  })
}

