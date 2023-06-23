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

  await core.cio.willHandleInput(true)
  await core.targetState.connect()
  await core.settings.set({
    AutoRunToLabelName: "main"
  })
  await core.targetState.getResets()
  await core.symbols.loadProgram(program)

  await core.waitForEvent({
    good: ({data, event}) => event == 'targetState.changed' && data.description == 'Suspended - H/W Breakpoint',
    timeout: 6 * 1000,
  }).catch(err=>{
    console.error('device did not enter expected target state')
    throw err
  })
  console.log('SUSPENDED')

  const stack = await core.callstack.fetch()
  console.log(stack.frames[0])
}

async function main() {
  const prefix = '/home/regular/.ti/TICloudAgent/tmp/ti_cloud_storage' 
  try {
    await run(
      join(prefix, 'CC2640R2F.ccxml'),
      join(prefix, 'uartecho_CC2640R2_LAUNCHXL_tirtos_ccs.out')
    )
  } catch(err) {
    console.error(err.stack)
    process.exit(1)
  }
}

main()
