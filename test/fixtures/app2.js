var net = require('net')
net.createServer(function(c) {
  c.write('2')
}).listen(8002)

