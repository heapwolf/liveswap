var cluster = require('cluster')
var http = require('http')
var numCPUs = require('os').cpus().length
var net = require('net')
var EventEmitter = require('events').EventEmitter
var split = require('split') 
var parse = require('through-parse')
var through = require('through')
var fs = require('fs')
var path = require('path')

var headpath = path.join(__dirname + '/HEAD')
var ee = new EventEmitter

function readHEAD() {
  return fs.readFileSync(headpath).toString()
}

function writeHEAD(value) {
  return fs.writeFileSync(headpath, value)
}

module.exports = function(opts) {

  if (typeof opts == 'string') {
    opts = { target: opts }
  }

  if (cluster.isMaster) {

    writeHEAD(opts.target)

    function sig(method, value, norespawn) {

      if (norespawn) {
        
        ee.emit('log', { 
          value: 'about to die',
          method: 'die'
        })

        setTimeout(function() {
          process.kill()
        }, 1e3)
      }

      if (method == 'upgrade') {
        writeHEAD(value)
      }

      Object
        .keys(cluster.workers)
        .forEach(function(id) {

          if (method == 'message') {
            ee.emit('log', { value: 'sent to all', method: method })
            return cluster.workers[id].send(value)
          }
          else if (method == 'upgrade') {
            ee.emit('log', { value: 'sending disconnect all', method: method })
            cluster.workers[id].disconnect(function() {
              cluster.fork()
            })
          }
          else {
            cluster.workers[id].kill()
            if (norespawn) {
              return
            }
            cluster.fork()
          }
        })
    }

    //
    // create a server to listen for out of process 
    // instructions to kill, disconnect or message workers.
    //
    var server = net.createServer(function(conn) {

      function log(d) {
        conn.write(JSON.stringify(d) + '\n')
      }

      ee.on('log', log)

      conn.on('close', function() {
        ee.removeListener('log', log)
      })

      conn
        .pipe(split())
        .pipe(parse())
        .pipe(through(function(data) {
          if (data && data.cmd) {
            switch(data.cmd) {
              
              case 'upgrade':
                sig('upgrade', data.value) 
              break
              
              case 'die':
                sig('die', null, true)
              break

              case 'kill': 
                sig('kill')
              break

              case 'message':
                if (data.value) {
                  sig('message', data.value)
                }
              break
            }
          }
        }))
    })

    server.listen(opts.port || 3000)

    for (var i = 0; i < (opts.forks || numCPUs); i++) {
      cluster.fork()
    }

    //
    // when a process exits, we should log the
    // failure, action the sevarity and respawn.
    //
    cluster.on('exit', function(worker, code, signal) {
      cluster.fork()
    })

    //
    // listen to various messages and events on the workers.
    //
    Object
      .keys(cluster.workers)
      .forEach(function(id) {
        cluster.workers[id].on('message', function(msg) {
          if (msg.cmd && msg.cmd) {
            cluster.workers[id][msg.cmd]()
          }
        })
      })
  }
  else {
    var target = readHEAD()
    var app = require(target)
  }
}
