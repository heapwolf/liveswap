var test = require('tap').test
var net = require('net')
var http = require('http')
var spawn = require('child_process').spawn
var fs = require('fs')
var path = require('path')
var rimraf = require('rimraf')
var split = require('split')
var parse = require('through-parse')

const FORKS = 7
const APP_PORT = 8002
const HEAD_PATH = __dirname + '/../HEAD'
const APP1_PATH = __dirname + '/fixtures/app1.js'
const APP2_PATH = __dirname + '/fixtures/app2.js'
const APP3_PATH = __dirname + '/fixtures/app3.js'
const APP1_LISTENING = /app1.js listening on 8002/g
const APP2_LISTENING = /app2.js listening on 8002/g

test('an app can be started with liveswap', function (t) {

  var wait = waitUntilForks(APP1_LISTENING, FORKS)
  var cp_liveswap = spawn('node', ['./bin/liveswap', '-s', APP1_PATH, '-f', FORKS])

  cp_liveswap.stdout.on('data', function (data) {
    wait(data, function() {
      var conn = net.connect(APP_PORT)
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
  })

})

test('an app can be sent a message with liveswap', function (t) {

  var wait = waitUntilForks(APP1_LISTENING, FORKS)
  var cp_liveswap = spawn('node', ['./bin/liveswap', '-s', APP1_PATH, '-f', FORKS])

  var err = null
  var count = 0
  var message_re = /message to worker/g
  const MESSAGE = 'message to worker'

  cp_liveswap.stdout.on('data', function (data) {
    var matches = data.toString().match(message_re)
    if (matches) { count += matches.length }

    wait(data, function() {
      var lshandle1 = spawn('node', ['./bin/liveswap', '-m', MESSAGE])

      lshandle1.stderr.on('data', function (data) {
        err = data
      })

      lshandle1.on('close', function() {
        t.ok(!err, 'no standard error output')
        t.ok(count === FORKS, 'there should have been ' + FORKS +
             ' messages sent to the server')
        rimraf(HEAD_PATH, function(err) {
          t.ok(!err)
          cp_liveswap.kill()
          t.end()
        })
      })
    })
  })

})

test('an app can be killed. all workers are killed and respawned', function (t) {

  var wait = waitUntilForks(APP1_LISTENING, FORKS)
  var cp_liveswap = spawn('node', ['./bin/liveswap', '-s', APP1_PATH, '-f', FORKS])

  var err = null

  cp_liveswap.stdout.on('data', function (data) {
    wait(data, function() {
      var lshandle1 = spawn('node', ['./bin/liveswap', '-k'])

      lshandle1.stderr.on('data', function (data) {
        err = data
      })

      lshandle1.on('close', function() {
        t.ok(!err, 'no standard error output')
        cp_liveswap.kill()
        t.end()
      })
    })
  })

})

test('an app can have its code swapped without restarting', function (t) {

  var waitForApp1 = waitUntilForks(APP1_LISTENING, FORKS)
  var waitForApp2 = waitUntilForks(APP2_LISTENING, FORKS)
  var cp_liveswap = spawn('node', ['./bin/liveswap', '-s', APP1_PATH, '-f', FORKS])

  cp_liveswap.stdout.on('data', function (data) {
    waitForApp1(data, function() {
      var conn = net.connect(APP_PORT)
      conn.on('data', function(d) {
        t.ok(d.toString() == '1')
        conn.end()
        spawn('node', ['./bin/liveswap', '-u', APP2_PATH])
      })
    })

    waitForApp2(data, function() {
      var conn = net.connect(APP_PORT)
      conn.on('data', function(d) {
        t.ok(d.toString() == '2')

        function die(err) {
          t.ok(!err)
          conn.end()
          cp_liveswap.kill()
          t.end()
        }

        rimraf(HEAD_PATH, die)
      })
    })

  })

})

test('pre-upgrade logic is executed', function (t) {

  const PRE = './test/fixtures/pre.js'

  var waitForApp1 = waitUntilForks(APP1_LISTENING, FORKS)
  var waitForApp2 = waitUntilForks(APP2_LISTENING, FORKS)
  var cp_liveswap = spawn('node', ['./bin/liveswap', '--pre-upgrade', PRE, '-s', APP1_PATH, '-f', FORKS])

  cp_liveswap.stdout.on('data', function (data) {
    waitForApp1(data, function() {
      var conn = net.connect(APP_PORT)
      conn.on('data', function(d) {
        t.ok(d.toString() == '1')
        conn.end()
        spawn('node', ['./bin/liveswap', '-u', APP3_PATH])
      })
    })

    waitForApp2(data, function() {
      var conn = net.connect(APP_PORT)
      conn.on('data', function(d) {
        t.ok(d.toString() == '2')

        function die(err) {
          t.ok(!err)
          conn.end()
          cp_liveswap.kill()
          t.end()
        }

        rimraf(HEAD_PATH, function(err) {
          t.ok(!err)
          rimraf(APP3_PATH, die)
        })
      })

    })

  })

})

test('failed pre-upgrade should error back to client', function (t) {

  const PRE_ERROR = './test/fixtures/pre-error.js'

  var waitForApp1 = waitUntilForks(APP1_LISTENING, FORKS)
  var cp_liveswap = spawn('node', ['./bin/liveswap', '--pre-upgrade', PRE_ERROR, '-s', APP1_PATH, '-f', FORKS])

  cp_liveswap.stdout.on('data', function (data) {
    waitForApp1(data, function() {
      var conn = net.connect(APP_PORT)
      conn.on('data', function(d) {
        t.ok(d.toString() == '1')
        conn.end()

        var lshandle1 = spawn('node', ['./bin/liveswap', '-u', APP3_PATH])

        lshandle1.stdout.on('data', function (data) {
          t.ok(data.toString().indexOf('Error: pre upgrade script failed') !== -1)
          cp_liveswap.kill()
          t.end()
        })

      })
    })

  })

})

function waitUntilForks(msg_re, forkCount) {
  var count = 0
  return function(data, cb) {
    var matches = data.toString().match(msg_re)
    if (matches) {
      count += matches.length
      if (count === forkCount) cb()
    }
  }
}
