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

      var queue = [];
      var keys = Object.keys(cluster.workers);

      keys.forEach(function(id, index) {

          if (method == 'message') {
            ee.emit('log', { value: 'sent to all', method: method })
            return cluster.workers[id].send(value)
          }
          else if (method == 'upgrade') {
            ee.emit('log', { value: 'sending disconnect all', method: method })

            //
            // stagger disconnects for better distribution
            // of the worker disconnection state.
            //
            if (index % 2 === 0 && index !== keys.length-1) { 
              return queue.push(id) 
            }

            cluster.workers[id].on('disconnect', function() {
              cluster.fork()
              var nextId = queue.pop()

              if (typeof nextId !== 'undefined') {
                cluster.workers[nextId].on('disconnect', function() {
                  cluster.fork()
                })
                setImmediate(function() {
                  cluster.workers[nextId].disconnect()
                })
              }
            })
            cluster.workers[id].disconnect()
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

    var forks = opts.forks || numCPUs
    
    if (forks < 2) {
      forks = 2
    }

    for (var i = 0; i < forks; i++) {
      cluster.fork()
    }

    //
    // when a process exits, we should log the
    // failure, action the sevarity and respawn.
    //
    cluster.on('exit', function(worker, code, signal) {
      cluster.fork()
    })
  }
  else {
    require(readHEAD())
  }
}
