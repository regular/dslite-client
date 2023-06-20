const API = require('./api')
const log = () => {}

API(log, (err, ds)=>{
  ds.getVersion( (err, {version})=>{
    if (err) return console.error(err.message)
    console.log(version)
  })

  ds.configure("/home/regular/.ti/TICloudAgent/tmp/ti_cloud_storage/CC2640R2F.ccxml",
    (err, {cores})=>{
      console.log(err, cores)
    }
  )

})
