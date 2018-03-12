# metaverse-socket.io-p2p
Networked A-Frame worlds [A-Frame](https://aframe.io/). I am in the middle of cleaning up this repo

Status: Only sending messages through Socket.io currently. P2P functionality is incredibly under documented and hidden away in other dependencies, so debugging is a nightmare. The following bit of logic is also a bit weird:

```
Socketiop2p.prototype.emit = function (data, cb) {
  var self = this
  var argsObj = cb || {}
  var encoder = new parser.Encoder()
  if (this._peerEvents.hasOwnProperty(data) || argsObj.fromSocket) {
    console.log("[P2P-CORE] EMIT ?? ");
    emitfn.apply(this, arguments)
  } else if (this.usePeerConnection || !this.useSockets) {
    console.log("[P2P-CORE] EMIT P2P");
    var args = toArray(arguments)
    var parserType = parser.EVENT // default
    if (hasBin(args)) { parserType = parser.BINARY_EVENT } // binary
    var packet = { type: parserType, data: args}

    encoder.encode(packet, function (encodedPackets) {
      if (encodedPackets[1] instanceof ArrayBuffer) {
        self._sendArray(encodedPackets)
      } else if (encodedPackets) {
        for (var i = 0; i < encodedPackets.length; i++) {
          self._send(encodedPackets[i])
        }
      } else {
        throw new Error('Encoding error')
      }
    })
  } else {
    console.log("[P2P-CORE] EMIT SOCKET");
    this.socket.emit(data, cb)
  }
}
```
I'm not sure what `if (this._peerEvents.hasOwnProperty(data) || argsObj.fromSocket) {` branches. More investigation is needed for this p2p extension

WebSocket wrapper:
- Socket.io-p2p https://github.com/socketio/socket.io-p2p

## How to run:

1. `npm install` You may need some dependencies I don't remember for the IPFS security libs, but it should be apparent in install
2. Rewrite IP address to yours in `src/app.js`
3. `npm start`
4. Connect to `http://<IP>:3003` in two different browser windows. Usually this would be over an HTTPS connection so you have to allow non-secure connection
5. You should be able to see interactions visible in both windows

** NOTE: top level directory contains a copy of the socket.io-p2p "2.0.1" library with some debugging messages. You can paste this over the npm installed one.

## UI:

- Pepe Frog button: indicates whether or not connected to PubNub WebRTC phone session. Used for VOIP
- [A-Frame](https://aframe.io/): sometimes the JS takes a while to load in the objects and everything, so your player may fall through the ground plane. If that happens just refresh until it loads in time. I had to find an odd way of simulating gravity/ flying mechanic
