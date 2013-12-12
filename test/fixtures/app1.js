var net = require('net')
net.createServer(function(c) {
  c.write('1')
}).listen(8002)

process.on('message', function(message) {
  console.log(message)
})