#!/usr/bin/env node
// jshint esversion: 11
const {join, resolve} = require('path')
const DSLite = require('./api')
const log = function() {
  console.log(Array.from(arguments).join(' '))
}
const conf = require('rc')('tirun')

async function run(target, program, comPort) {
  const ds = await DSLite({log, promisify: true})

  const {version} = await ds.getVersion()
  console.log('DSLite version:', version)

  let cores
  try {
    const data = await ds.configure(target)
    cores = data.cores
  } catch(err) {
    console.error('Unable to configure target: ' + err.message)
    return false
  }
  console.log('cores', cores)
  const core = await ds.createSubModule(cores[0])

  await core.cio.willHandleInput(true)
  await core.targetState.connect()
  await core.settings.set({
    AutoRunToLabelName: "main"
  })
  await core.targetState.getResets()
  try {
    await core.symbols.loadProgram(program)
  } catch(err) {
    console.error('Failed to load program. (Wrong MCU model?) '+err.message)
    return false
  }

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

  serial(comPort)
  core.targetState.run()
  await core.waitForEvent({
    good: ({data, event}) => event == 'targetState.changed' && data.description == 'Running',
    timeout: 6 * 1000,
  })
  console.log('Target is running')
  return true
}

async function main() {
  const cloud_storage = '/home/regular/.ti/TICloudAgent/tmp/ti_cloud_storage' 
  const ccxml_dir = '/opt/ti/uniflash/deskdb/content/TICloudAgent/linux/ccs_base/arm'
  const ccxml2pin = 'cc13xx_cc26xx_2pin_cJTAG_XDS110.ccxml'
  //const aout = join(__dirname, '..', 'chipinfo-fw', 'app/tirtos/ccs/chipinfo-fw.out')
  const aout = join(cloud_storage, 'uart2echo_LP_CC2652RB_tirtos7_ticlang.out')

  /*

  if (conf._.length !== 3) {
    throw new Error('too few arguments')
  }

  let [target, firmware, comPort] = conf._
  target = resolve(process.cwd(), target)
  firmware = resolve(process.cwd(), firmware)
  console.log(target, firmware)
  */

  let success
  try {
    success = await run(
      //join(cloud_storage, 'CC2640R2F.ccxml'),
      //join(cloud_storage, 'b89231b1.ccxml'),
      //join(__dirname, '..', 'detect', 'CC2652RB1F-L120048P.ccxml'),
      //join(__dirname, '..', 'titect', 'L120048P-CC2652RB1F.ccxml'),
      join(ccxml_dir, ccxml2pin),
      //join(prefix, 'uartecho_CC2640R2_LAUNCHXL_tirtos_ccs.out')
      aout,
      '/dev/ttyACM0'
      //target, firmware, comPort
    )
  } catch(err) {
    console.error(err.stack)
    process.exit(1)
  }
  if (!success) process.exit(1)
}

main()

function serial(path) {
  const { SerialPort, ReadlineParser } = require('serialport')
  const baudRate = 115200
  const port = new SerialPort({ path, baudRate })
  port.pipe(process.stdout)
  setTimeout(()=>{
    port.write('ROBOT PLEASE RESPOND\n')
  }, 200)
}
