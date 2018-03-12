# metaverse-js-centralized
Networked A-Frame worlds [A-Frame](https://aframe.io/). I am in the middle of cleaning up this repo

WebSocket wrapper: 
- Socket.io https://github.com/socketio/socket.io

## How to run:

1. `npm install` You may need some dependencies I don't remember for the IPFS security libs, but it should be apparent in install
2. `npm start`
3. Connect to http://localhost:3003 in two different browser windows. Usually this would be over an HTTPS connection so you have to allow non-secure connection
4. You should be able to see interactions visible in both windows

## UI:

- Pepe Frog button: indicates whether or not connected to PubNub WebRTC phone session. Used for VOIP
- [A-Frame](https://aframe.io/): sometimes the JS takes a while to load in the objects and everything, so your player may fall through the ground plane. If that happens just refresh until it loads in time. I had to find an odd way of simulating gravity/ flying mechanic
