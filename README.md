# SYNOPSIS
Safe code hotswap for zero downtime re-deploys.

# MOTIVATION
An application in production should not need to be stopped in order to
utilize new code. 

# DESCRIPTION
Liveswap does two things. **1.** Fork worker processes with some arbitrary 
code. **2.** Instruct a worker to restart using different code after existing 
connections have been normally closed. Meanwhile at least one or more workers
continue to run.

# USAGE

## Install
```bash
npm install liveswap -g
```

## Example
Using the node.js hello world example, in a filed named `index1.js`...

### First Version (Sample Code)
```js
var http = require('http')
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('Hello World\n')
}).listen(1337, '127.0.0.1')
console.log('Server running at http://127.0.0.1:1337/')
```

### Startup
Start the application using liveswap from the command-line...

```bash
liveswap -s index1.js
```
Alternatively, start liveswap programmatically...

```js
var liveswap = require('liveswap')
liveswap('./index1.js')
```

### Second Version (Sample Code)
Now we have an updated version of the code in `index2.js`...

```js
var http = require('http')
http.createServer(function (req, res) {
  res.writeHead(404, {'Content-Type': 'text/plain'})
  res.end('Not Found\n')
}).listen(1337, '127.0.0.1')
console.log('Server running at http://127.0.0.1:1337/')
```

### Live Update
Update the current code by sending an update command to the server.

```js
liveswap -u ./index2.js
```

After sending an update message the worker processes will wait for
any current connections to end before restarting with the new code.

# CLI Options

```bash
Options:
  -p, --port     <port> specify the source code to upgrade to.                 [default: 3000]
  -a, --address  <address> specify the ip address to run on.                   [default: "127.0.0.1"]
  -f, --forks    <number> specify how many worker processes to spawn           [default: 2]
  -u, --upgrade  <path> specify the source code to upgrade to.
  --pre-upgrade  <path> a module to handle pre upgrade logic.
  -k, --kill     kill all forked worker processes and respawn.
  -d, --die      kill all forked worker processes and quit master process.
  -m, --message  <message> send a message to all the forked worker processes.
  -s, --start    <path> start a node process cluster.
```

# API

## liveswap(opts)
The main export of this library accepts an options object or a string. If a 
string is specified, it will be interpreted as the `target` option.

### [option] `{ target: <String> }`

### [option] `{ port: <Number> }`

### [option] `{ forks: <Number> }`

```js
liveswap({
  port: 9008,
  forks: 2,
  target: './versions/v0.0.2'
})
```
