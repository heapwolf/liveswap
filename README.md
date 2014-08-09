# SYNOPSIS
Safe code hotswap for zero downtime re-deploys.

# BUILD STATUS
[![Build Status](http://img.shields.io/travis/hij1nx/skipfile.svg?style=flat)](https://travis-ci.org/hij1nx/skipfile)

# MOTIVATION
An application in production should not need to be stopped in order to
utilize new code.

# DESCRIPTION
liveswap is a library that helps you update an application’s code without stopping it.
It also ships with a command-line tool and it doesn’t impose any special requirements
or conventions on your application code.

It works by creating a light-weight master process that runs your application code as
worker processes. It then starts listening for instructions.

When you send an upgrade instruction, workers take turns disconnecting their underlying
servers. When a server is disconnected, it lets the old connections finish up, but no
new connections are accepted. When all of the worker’s connections have been closed, it
will be retired and a new one will be created using the new code. For more in depth
information read [`this`][0] blog post.

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
  -p, --port     <port> specify the liveswap server port.                      [default: 3000]
  -a, --address  <address> specify the ip address to run on.                   [default: "127.0.0.1"]
  -f, --forks    <number> specify how many worker processes to spawn           [default: 2]
  -u, --upgrade  [<path>] specify the source code to upgrade to.
  --pre-upgrade  <path> a module to handle pre upgrade logic.
  -k, --kill     kill all forked worker processes and respawn.
  -d, --die      kill all forked worker processes and quit master process.
  -m, --message  <message> send a message to all the forked worker processes.
  -s, --start    <path> start a node process cluster.
  -H, --head     <path> path to HEAD file
  -z             disable zero-downtime, upgrade will kill processes
  -v, --version  print program version and exit
```

Pre-upgrade allows you to require a module that will be executed before each
time the upgrade happens.

```bash
liveswap --pre-upgrade ./pull.js --start ./index1.js
```

The pre-upgrade module should export a single function as its interface.
Here's an example of what that module might look like:

```js
function preupgrade(data, callback) {
  console.log('executing pre-upgrade script...');

  var err, value = data.value;
  try {
    // execute pre-upgrade code
  } catch (e) {
    err = e.toString();
  }

  return callback(err, value);
}
module.exports = preupgrade;
```

# API

## liveswap(opts)
The main export of this library accepts an options object or a string. If a
string is specified, it will be interpreted as the `target` option.

### [option] `{ target: <String> }`

### [option] `{ port: <Number> }`

### [option] `{ forks: <Number> }`

### [option] `{ "pre-ugrade": <String> }`

```js
liveswap({
  port: 9008,
  forks: 2,
  target: './index.js'
  "pre-upgrade": './pull.js'
})
```

[0]:https://medium.com/node-js-javascript/f00ce09abb77
