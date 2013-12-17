var test = require('tap').test
var net = require('net')
var http = require('http')
var spawn = require('child_process').spawn
var fs = require('fs')
var path = require('path')
var rimraf = require('rimraf')
var split = require('split') 
var parse = require('through-parse')

var l = console.log

const APP_PORT = 8002
const HEAD_PATH = __dirname + '/../HEAD'
const APP1_PATH = __dirname + '/fixtures/app1.js'
const APP2_PATH = __dirname + '/fixtures/app2.js'
const APP3_PATH = __dirname + '/fixtures/app3.js'

test('an app can be started with liveswap', function (t) {

  l('Spawning the application as a child process (0)')
  var cp_liveswap = spawn('node', ['./bin/liveswap', '-s', APP1_PATH, '-f', '7'])

  cp_liveswap.stderr.on('data', function (data) {
    console.log('stderr (0): ' + data)
  })

  cp_liveswap.stdout.on('data', function (data) {
    console.log('stdout (0): ' + data)
  })

  setTimeout(function() {
    var conn
    l('opening a connection to the application')

    conn = net.connect({ port: APP_PORT }, function() {
      conn.on('data', function(d) {
        
        t.ok(d.toString() == '1')

        rimraf(HEAD_PATH, function(err) {
          t.ok(!err)
          conn.end()
          cp_liveswap.kill()
          t.end()
        })
      })
    })
  }, 1500)
})

test('an app can be sent a message with liveswap', function (t) {
  
  var err = null
  var count = 0
  var message_re = /message to worker/g

  const MESSAGE = 'message to worker'
  const FORKS = 7

  l('Spawning the application as a child process (0)')
  var cp_liveswap = spawn('node', ['./bin/liveswap', '-s', APP1_PATH, '-f', FORKS])
  
  cp_liveswap.stderr.on('data', function (data) {
    console.log('stderr (0): ' + data)
  })

  cp_liveswap.stdout.on('data', function (data) {
    console.log('stdout (0): ' + data)

    var matches = data.toString().match(message_re)
    if (matches) {
      count += matches.length
    }
  })

  setTimeout(function() {

    l('sending a message to all the workers (1)')
    var lshandle1 = spawn('node', ['./bin/liveswap', '-m', MESSAGE])

    lshandle1.stderr.on('data', function (data) {
      err = data
      console.log('stderr (1): ' + data)
    })

    lshandle1.stdout.on('data', function (data) {
      console.log('stdout (1): ' + data)
    })

    lshandle1.on('close', function() {
      t.ok(!err, 'no standard error output')
      t.ok(count === FORKS, 'there should have been ' + FORKS + ' messages sent to the server')

      rimraf(HEAD_PATH, function(err) {
        t.ok(!err)
        cp_liveswap.kill()
        t.end()
      })
    })

  }, 1500)
})


test('an app can be killed. all workers are killed and respawned', function (t) {
  
  var err = null
  const FORKS = 7

  l('Spawning the application as a child process (0)')
  var cp_liveswap = spawn('node', ['./bin/liveswap', '-s', APP1_PATH, '-f', FORKS])
  
  cp_liveswap.stderr.on('data', function (data) {
    console.log('stderr (0): ' + data)
  })

  cp_liveswap.stdout.on('data', function (data) {
    console.log('stdout (0): ' + data)
  })

  setTimeout(function() {

    l('sending a message to all the workers (1)')
    var lshandle1 = spawn('node', ['./bin/liveswap', '-k'])

    lshandle1.stderr.on('data', function (data) {
      err = data
      console.log('stderr (1): ' + data)
    })

    lshandle1.stdout.on('data', function (data) {
      console.log('stdout (1): ' + data)
    })

    lshandle1.on('close', function() {
      t.ok(!err, 'no standard error output')
      cp_liveswap.kill()
      t.end()
    })

  }, 1500)
})


test('an app can have its code swapped without restarting', function (t) {
  
  var err = null
  var count = 0
  const FORKS = 7
  var message

  l('Spawning the application as a child process (0)')
  var cp_liveswap = spawn('node', ['./bin/liveswap', '-s', APP1_PATH, '-f', FORKS])
  
  cp_liveswap.stderr.on('data', function (data) {
    console.log('stderr (0): ' + data)
  })

  cp_liveswap.stdout.on('data', function (data) {
    console.log('stdout (0): ' + data)
  })

  setTimeout(function() {

    var conn1
    l('opening a connection to the application')

    conn1 = net.connect({ port: APP_PORT }, function() {
      conn1.on('data', function(d) {
        
        t.ok(d.toString() == '1')
        conn1.end()
        setTimeout(swap, 1500)
      })
    })

    function swap() {
      l('sending upgrade (1)')
      var lshandle1 = spawn('node', ['./bin/liveswap', '-u', APP2_PATH])

      lshandle1.stderr.on('data', function (data) {
        err = data
        console.log('stderr (1): ' + data)
      })

      lshandle1.stdout.on('data', function (data) {
        console.log('stdout (1): ' + data)

        if (data.toString().indexOf('OK') > -1) {
          
          setTimeout(function() {
            var conn2
            l('opening a connection to the application')

            conn2 = net.connect({ port: APP_PORT }, function() {
              conn2.on('data', function(d) {
                t.ok(d.toString() == '2')

                function die(err) {
                  t.ok(!err)
                  conn2.end()
                  cp_liveswap.kill()
                  t.end()
                }

                rimraf(HEAD_PATH, die)
              })
            })
          }, 1500)
        }
      })
    }

  }, 1500)
})

test('pre-upgrade logic is executed', function (t) {
  
  var err = null
  var count = 0
  const FORKS = 7
  const PRE = './test/fixtures/pre.js'
  var message

  l('Spawning the application as a child process (0)')
  var cp_liveswap = spawn('node', ['./bin/liveswap', '--pre-upgrade', PRE, '-s', APP1_PATH, '-f', FORKS])
  
  cp_liveswap.stderr.on('data', function (data) {
    console.log('stderr (0): ' + data)
  })

  cp_liveswap.stdout.on('data', function (data) {
    console.log('stdout (0): ' + data)
  })

  setTimeout(function() {

    var conn1
    l('opening a connection to the application')

    conn1 = net.connect({ port: APP_PORT }, function() {
      conn1.on('data', function(d) {
        
        t.ok(d.toString() == '1')
        conn1.end()
        setTimeout(swap, 1500)
      })
    })

    function reconnect() {
      var conn2
      l('opening a connection to the application')

      conn2 = net.connect({ port: APP_PORT }, function() {
        conn2.on('data', function(d) {
          t.ok(d.toString() == '2')

          function die(err) {
            t.ok(!err)
            conn2.end()
            cp_liveswap.kill()
            t.end()
          }

          rimraf(HEAD_PATH, function(err) {
            t.ok(!err)
            rimraf(APP3_PATH, die)
          })
        })
      })
    }

    function swap() {
      l('sending upgrade (1)')
      var lshandle1 = spawn('node', ['./bin/liveswap', '-u', APP3_PATH])

      lshandle1.stderr.on('data', function (data) {
        err = data
        console.log('stderr (1): ' + data)
      })

      lshandle1.stdout.on('data', function (data) {
        console.log('stdout (1): ' + data)

        if (data.toString().indexOf('OK') > -1) {
          setTimeout(reconnect, 1500)
        }
      })
    }

  }, 1500)
})
