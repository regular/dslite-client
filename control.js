// jshint esversion: 11
const {join} = require('path')
const DSLite = require('./api')
const log = function() {
  //console.log(Array.from(arguments).join(' '))
}

async function run(target, program) {
  const ds = await DSLite({log, promisify: true})

  const {version} = await ds.getVersion()
  console.log('DSLite version:', version)

  const {cores} = await ds.configure(target)
  console.log('cores', cores)
  const core = await ds.createSubModule(cores[0])
  
  await core["cio.willHandleInput"](true)
  await core["targetState.connect"]()
  await core["settings.set"]({
    AutoRunToLabelName: "main"
  })
  await core["targetState.getResets"]()
  await core["symbols.loadProgram"](program)

  // TODO: how do wewait for completion?
  // wait for event: [Cortex_M3_0] DS-> Target state changed to "Suspended - H/W Breakpoint"

  const stack = await core["callstack.fetch"]()
  console.log(stack)
}

try {
  const prefix = '/home/regular/.ti/TICloudAgent/tmp/ti_cloud_storage' 
  run(
    join(prefix, 'CC2640R2F.ccxml'),
    join(prefix, 'uartecho_CC2640R2_LAUNCHXL_tirtos_ccs.out')
  )
} catch(err) {
  console.error(err.message)
  process.exit(1)
}
