var assert = require('better-assert')
var net = require('net')
var http = require('http')
var spawn = require('child_process').spawn
var fs = require('fs')
var rimraf = require('rimraf')
var path = require('path')

var l = console.log
var app1path = __dirname + '/fixtures/app1.js'
var app2path = __dirname + '/fixtures/app2.js'

l('Spawning the application as a child process (0)')
var cp = spawn('node', ['./bin/liveswap', '-s', app1path, '-f', '7'])

cp.stdout.on('data', function (data) {
  console.log('stdout (0): ' + data)
})

cp.stderr.on('data', function (data) {
  console.log('stderr (0): ' + data)
})

const APP_PORT = 8002

var app1handle
var app2handle
var lshandle1
var lshandle2
var lshandle3

setTimeout(function() {

  l('opening a connection to the application')
  app1handle = net.connect({ port: APP_PORT }, function() {
    app1handle.on('data', onAppData)
  })

  function onAppData(d) {
    l('checking response from the first version of the code')
    assert(d.toString() == '1')
    app1handle.end()

    l('sending a message to all the workers (1)')
    var lshandle1 = spawn('node', ['./bin/liveswap', '-m', 'message to worker'])
    var lshandle1out = ''

    lshandle1.stdout.on('data', function (data) {
      console.log('stdout (1): ' + data)
    })

    lshandle1.stderr.on('data', function (data) {
      lshandle1out += data
      console.log('stderr (1): ' + data)
    })

    lshandle1.on('close', function() {
      assert(lshandle1out.indexOf('OK') > -1)
      setTimeout(swap, 500)
    })
  }

  function swap() {

    l('sending an upgrade instruction to the process (2)')
    var lshandle2 = spawn('node', ['./bin/liveswap', '-u', app2path])

    lshandle2.stdout.on('data', function (data) {
      console.log('stdout (2): ' + data)
    })

    lshandle2.stderr.on('data', function (data) {
      console.log('stderr (2): ' + data)
    })

    lshandle2.on('close', check)
    
    function check(code) {
      assert(code == 0)

      setTimeout(function() {

        app2handle = net.connect({ port: APP_PORT }, function() {
          app2handle.on('data', function(d) {
            l('checking response from the second version of the code')
            assert(d.toString() == '2')
            cleanup()
          })
        })
      }, 1500)
    }
  }

  function cleanup() {

    l('sending a takedown instruction to the process (3)')
    lshandle3 = spawn('node', ['./bin/liveswap', '-d'])

    lshandle3.stdout.on('data', function (data) {
      console.log('stdout (3): ' + data)
    })

    lshandle3.stderr.on('data', function (data) {
      console.log('stderr (3): ' + data)
    })

    lshandle3.on('close', function(code) {

      assert(code == 0)

      l('cleaning up temp files')
      rimraf(__dirname + '/../HEAD', function(err) {
        assert(!err)
        process.exit(0)
      })
    })
  }

}, 500)
