var net = require('net')
var server = net.createServer(function(c) {
  c.write('2')
}).listen(8002)

server.on('listening', function() {
  console.log('app2.js listening on 8002')
})
