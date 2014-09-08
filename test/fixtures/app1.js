var net = require('net')
var server = net.createServer(function(c) {
  c.write('1')
}).listen(8002)

server.on('listening', function() {
  console.log('app1.js listening on 8002')
})

process.on('message', function(message) {
  console.log(message)
})

