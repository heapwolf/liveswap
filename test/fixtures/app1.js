var net = require('net')
net.createServer(function(c) {
  c.write('1')
}).listen(8002)

