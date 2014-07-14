var through = require('through')
var parse = require('through-parse')
var split = require('split')
var net = require('net')

//
// send a command to the liveswap server over tcp
// using a simple JSON protocol.
//
var exec = exports.exec = function(args) {

  if (typeof args[0] == 'function') {
    options = {}
  }
  else if (typeof args[0] == 'string') {
    options = { value: args[0] }
  }
  else {
    options = args[0] || {}
  }

  var cmd = options.cmd || args.callee.name
  var value = options.value || ''
  var port = options.port || 3000
  var host = options.host || '127.0.0.1'
  var cb = args[1]

  if (!cb) {
    throw new Error('callback required');
  }

  var stream = net.connect(port, host, function() {
    var message = { cmd: cmd, value: value }
    stream.write(JSON.stringify(message) + '\n')
  })

  var fin

  stream.on('error', function(err) {
    if (!fin) {
      fin = true
      cb(err)
    }
  })

  stream
    .pipe(split())
    .pipe(parse())
    .on('data', function(data) {
      if (!fin && data.cmd == cmd) {
        cb(data)
      }
    })
}

exports.upgrade = function upgrade() { exec(arguments) }
exports.kill = function kill() { exec(arguments) }
exports.die = function die() { exec(arguments) }
exports.message = function message() { exec(arguments) }
exports.preupgrade = function preupgrade() { exec(arguments) }
