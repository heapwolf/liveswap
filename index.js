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

function reply(cmd, value) {
  ee.emit('reply', { cmd: cmd, value: value || 'OK' })
}

module.exports = function(opts) {

  if (typeof opts == 'string') {
    opts = { target: opts }
  }
  if (typeof opts['zero-downtime'] === 'undefined') {
    opts['zero-downtime'] = true
  }
  if (opts.head) {
    headpath = opts.head
  }

  if (!cluster.isMaster) {
    try {
      require(readHEAD())
    }
    catch(ex) {
      console.error(ex)
    }
    return
  }

  writeHEAD(opts.target)

  function sig(cmd, value) {
    if (cmd !== 'upgrade') return broadcast()

    var mpath = path.resolve(value)
    fs.stat(mpath, function(err, stat) {
      if (err) return reply(cmd, err)
      writeHEAD(mpath)
      broadcast()
    })

    function broadcast() {
      var keys = Object.keys(cluster.workers)

      keys.forEach(function(id, index) {
        var worker = cluster.workers[id]
        if (cmd === 'message') {
          worker.send(value)
        }
        else if (cmd === 'upgrade' && opts['zero-downtime']) {
          if (index % 2 === 0 && !isLast(index)) {
            cluster.fork()
            setImmediate(function() {
              worker.disconnect()
            })
          }
          else {
            worker.disconnect()
            worker.on('disconnect', function() {
              cluster.fork()
            })
          }
        }
        else if (cmd === 'upgrade' || cmd === 'kill') {
          worker.kill()
          cluster.fork()
        }
        else if (cmd === 'die') {
          worker.kill()
          if (isLast(index)) {
            reply(cmd)
            process.kill()
          }
        }
      })

      reply(cmd)

      function isLast(i) { return i === keys.length - 1 }
    }
  }

  //
  // create a server to listen for out of process 
  // instructions to kill, disconnect or message workers.
  //
  var server = net.createServer(function(conn) {

    var cmd

    function onReply(d) {
      conn.write(JSON.stringify(d) + '\n')
    }

    ee.on('reply', onReply)
    conn.on('close', function() { ee.removeListener('reply', onReply) })
    conn.on('error', function(err) { reply(cmd, err) })

    conn
      .pipe(split())
      .pipe(parse())
      .pipe(through(function(data) {
        if (!data || !data.cmd) return

        cmd = data.cmd

        switch(cmd) {
          case 'upgrade':
            if (opts['pre-upgrade']) {
              return require(opts['pre-upgrade'])(data, function(err, value) {
                if (err) return reply(cmd, err)
                sig('upgrade', value || data.value || opts.target)
              })
            }
            sig('upgrade', data.value)
          break

          case 'die':
            sig('die')
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
      }))
  })

  server.listen(opts.port || 3000, opts.address, function() {
    console.log('Starting on port %d', opts.port)
  })

  var forks = opts.forks || numCPUs

  for (var i = 0; i < forks; i++) {
    cluster.fork()
  }
}

