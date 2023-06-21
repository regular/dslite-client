// jshint esversion: 11


const API = require('./api')
const log = function() {
  console.log(Array.from(arguments).join(' '))
}

API({log, promisify: true }, async (err, ds)=>{
  if (err) return log(err)

  const {version} = await ds.getVersion()
  console.log(version)

  const {cores} = await ds.configure("/home/regular/.ti/TICloudAgent/tmp/ti_cloud_storage/CC2640R2F.ccxml")
  console.log('cores', cores)
  const core = await ds.createSubModule(cores[0])
  
  await core["cio.willHandleInput"](true)
  await core["targetState.connect"]()
  await core["callstack.fetch"]()
  await core["settings.set"]({
    AutoRunToLabelName: "main"
  })
  await core["targetState.getResets"]()
  await core["symbols.loadProgram"](
    "/home/regular/.ti/TICloudAgent/tmp/ti_cloud_storage/uartecho_CC2640R2_LAUNCHXL_tirtos_ccs.out"
  )
  const stack = await core["callstack.fetch"]()
  console.log(stack)
})
