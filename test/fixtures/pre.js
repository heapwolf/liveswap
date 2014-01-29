var exec = require('child_process').exec
var path = require('path')
var fs = require('fs')
var ASSERT = require('assert').ok
 
module.exports = function(target, done) {
  var cmd = 'cp ./app2.js ./app3.js'
  var opts = {
    cwd: __dirname
  }
  exec(cmd, opts, function(err, stdout, stderr) {
    var p = __dirname + '/app3.js'
    ASSERT(fs.statSync(p))
    done(err || null, p)
  })
}
