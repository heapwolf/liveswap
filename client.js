var through = require('through')
var parse = require('through-parse')
var split = require('split')
var net = require('net')

//
// send a command to the liveswap server over tcp
// using a simple JSON protocol.
//
var exec = exports.exec = function(command, value, port, cb) {


  if (typeof command == 'object') {
    value = command[0]
    port = command[1]
    cb = command[2]
    cmd = command.callee.name
  }


  if (typeof port == 'function') {
    cb = port
    port = null
  }


  var stream = net.connect(port || 3000, function() {
    var message = { cmd: cmd, value: value || '' }
    stream.write(JSON.stringify(message) + '\n')
  })

  var fin

  if (cb) {
    stream
      .pipe(split())
      .pipe(parse())
      .on('error', function(err) {
        if (!fin) {
          fin = true
          cb(err)
        }
      })
      .on('data', function(data) {
        console.log(data)
        if (!fin && data.cmd == cmd) {
          cb(data)
        }
      })
  }
}

exports.upgrade = function upgrade() { exec(arguments) }
exports.kill = function kill() { exec(arguments) }
exports.die = function die() { exec(arguments) }
exports.message = function message() { exec(arguments) }

