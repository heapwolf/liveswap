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
```
$ npm install liveswap -g
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

```
$ liveswap -s index1.js
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

```
$ liveswap -u ./index2.js
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
  --pre-upgrade  <path> command to handle pre upgrade logic.
  -k, --kill     kill all forked worker processes and respawn.
  -d, --die      kill all forked worker processes and quit master process.
  -m, --message  <message> send a message to all the forked worker processes.
  -s, --start    <path> start a node process cluster.
  -H, --head     <path> path to HEAD file
  -z             disable zero-downtime, upgrade will kill processes
  -v, --version  print program version and exit
```

`--pre-upgrade` allows you to execute a command before any of the forks are restarted. For example updating a git repositorory, check out some branch etc.

```
$ liveswap --pre-upgrade ./pull.sh --start ./index1.js
```

The `--pre-upgrade` script has to execute successfully in order for the upgrade to succeed. A value used with the `-u` flag will be passed on to the command.

Here's an example of what a script might look like:

```bash
#!/usr/bin/bash
set -e
cd ~/myapp
git fetch origin
git reset --hard $1
rm -rf node_modules
npm install --production
npm dedupe
npm run bundle.js
npm test
```

So to check out the `origin/master` branch you would issue the command:

```
$ liveswap -u origin/master
```

# API

## liveswap(opts)
The main export of this library accepts an options object or a string. If a
string is specified, it will be interpreted as the `target` option. The options
object can have the following properties:

* `'target'` *(string)* Path to application that liveswap should run.
* `'forks'` *(number, default: `2`)* Number of forks for the application.
* `'port'` *(number, default: `3000`)* Listen to connections on this port.
* `'address'` *(string, default: `'127.0.0.1'`)* Address to accept connections from. Set to `'0.0.0.0'` to accept connections from all ip addresses.
* `'head'` *(string, default: `__dirname + '/HEAD'`)* Path to HEAD file.
* `'pre-upgrade'` *(string)* Path to pre upgrade script.
* `'zero-downtime'` *(boolean: default: `true`)* When set to `true`, disconnects forks instead of killing them and if a fork dies, it is automatically restarted.

```js
liveswap({
  target: './index.js',
  forks: 2,
  port: 9008,
  address: '0.0.0.0',
  head: '/tmp/HEAD',
  'pre-upgrade': './pull.sh',
  'zero-downtime': false
})
```

[0]:https://medium.com/node-js-javascript/f00ce09abb77