//HTTPS
const k_USE_HTTPS = false;

var ecstatic = require('ecstatic')
var fs = require('fs')
var Slack = require('slack-node')
var MongoClient = require('mongodb').MongoClient
var assert = require('assert')
var express = require('express')
var bodyParser = require('body-parser')
var formidable = require('formidable')
var path = require('path')
var wav = require('wav')

var database; //mongo reference created later

// If you want to ping to your dev team slack of events
//webhookUri = "https://hooks.slack.com/services/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"
//
// slack = new Slack();
// slack.setWebhook(webhookUri);

// For HTTPS configurations
var https_cert_options;
if (k_USE_HTTPS) {
  https_cert_options = {
    key: fs.readFileSync('../topsecret/example.com.key'),
    cert: fs.readFileSync('../topsecret/9ca2a53ff8ed893e.crt')
  }
} else {
  https_cert_options = {};
}

var app = express();
app.all('/topsecret', function (req,res, next) {
   res.status(403).send({
      message: 'Access Forbidden'
   });
});
app.use(ecstatic({
  root: __dirname,
  handleError : false
}));
app.use(function(req,res,next) {
  // res.header("Access-Control-Allow-Origin","*")
  res.header("Access-Control-Allow-Methods","POST,GET")
  // res.header("Access-Control-Allow-Headers","Origin, X-Requested-With, Content-Type, Accept")
  next()
})
app.use(bodyParser.json())
app.use(bodyParser.urlencoded())
var server;
if (k_USE_HTTPS) {
  server = require('https').createServer(https_cert_options, app)
} else {
  server = require('http').createServer(app)
}

app.get('/coordinates', function(req, res) {
  var xCoord = req.query.x;
  var zCoord = req.query.z;
  console.log("\x1b[2mreceived request for assets for " + JSON.stringify(req.query) + "\x1b[0m");
  if (xCoord != null) {
    var collection = database.collection('blocks')
    collection.findOne({"location":{"x":xCoord, "z":zCoord}}, function(error,document) {
      // console.log("about to send back " + JSON.stringify(document));
      if (document) {
        res.writeHead(200, {"Content-Type":"application/json"})
        res.end(JSON.stringify([document]));
      } else {
        res.writeHead(405, {})
      }
    })
  }
})

app.get('/blocks', function(req, res) {
  var name = req.query.block;
  console.log("\x1b[2mreceived request for assets for " + name + "\x1b[0m");
  if (name != null) {
    var collection = database.collection('blocks')
    collection.findOne({"name":name}, function(error,document) {
      // console.log("about to send back " + JSON.stringify(document));
      if (document) {
        res.writeHead(200, {"Content-Type":"application/json"})
        res.end(JSON.stringify(document));
      } else {
        res.writeHead(405, {})
        res.end()
      }
    })
  }
})

app.post('/update-property', function(req, res) {
  console.log(req.body);
  var blockName = req.body.block;
  var objectName = req.body.name;
  var updateType = req.body.updateType;
  var updateValueRawstring = req.body.value;
  var collection = database.collection('blocks');
  collection.findOne({"name":blockName}, function(error,document) {
    if (document == null) {
      res.writeHead(405, {})
      res.end()
      return;
    }
    console.log("about to send back " + JSON.stringify(document));

    // should do this in mongo query but yolo lmao
    var objects = document["objects"];
    for (i=0;i<objects.length;i++) {
      var object = objects[i];
      if (object["name"] == objectName) {
        var properties = object["properties"];
        var valueSplit = updateValueRawstring.split(" ");
        var fieldName = "position";
        if (updateType == "rot") {
          fieldName = "rotation";
        }
        if (updateType == "sca") {
          fieldName = "scale";
        }
        //CSdegree
        var newValue = {"x":valueSplit[0], "y":valueSplit[1], "z":valueSplit[2]};
        properties[fieldName] = newValue;
        objects[i] = object; // i dont trust pointer conventions
        document["objects"] = objects;
        collection.update({"name":blockName}, document, function(error,result) {
          res.writeHead(200, {})
          res.end()
        });
        break;
      }
    }
  })
})

app.post('/delete-object', function(req, res) {
  console.log(req.body);
  var blockName = req.body.block;
  var objectName = req.body.name;
  var collection = database.collection('blocks');
  collection.findOne({"name":blockName}, function(error,document) {
    if (document == null) {
      res.writeHead(405, {})
      res.end()
      return;
    }
    console.log("about to send back " + JSON.stringify(document));

    // should do this in mongo query but yolo lmao
    var objects = document["objects"];
    var newList = [];
    for (i=0;i<objects.length;i++) {
      var object = objects[i];
      if (object["name"] != objectName) {
        newList.push(object);
      }
    }
    document["objects"] = newList;
    collection.update({"name":blockName}, document, function(error,result) {
      io.sockets.emit('model-declared', {})
      res.writeHead(200, {})
      res.end()
    });
  })
});

app.post('/add-asset', function(req, res) {
    console.log("request to /add-asset");
    var form = new formidable.IncomingForm();
    // form.multiples = true;
    var propertiesDict = {};
    propertiesDict["type"] = "obj"; // only accept obj for now
    form.uploadDir = path.join(__dirname, '/assets');
    var name;
    var randid = Math.random().toString(36).substring(7);
    form.on('file', function(field, file) {
      console.log("received file " + field + " " + file.name + " at " + file.path);
      fs.rename(file.path, path.join(form.uploadDir, randid + file.name));
      if (propertiesDict["file1"] == null) {
        if ((file.name.indexOf(".obj") != -1) && (file.name.indexOf(".mtl") == -1)) {
          propertiesDict["file1"] = randid+file.name;
        }
        if (file.name.indexOf(".ply") != -1) {
          propertiesDict["file1"] = randid+file.name;
          propertiesDict["type"] = "ply";
        }
      }
      if (propertiesDict["file2"] == null) {
        if (file.name.indexOf(".mtl") != -1) {
          propertiesDict["file2"] = randid+file.name;
        }
      }
    });
      propertiesDict["position"] = {"x":0, "y":30, "z":0};
      propertiesDict["rotation"] = {"x":0, "y":0, "z":0};
      propertiesDict["scale"] = {"x":1, "y":1, "z":1};
    // log any errors that occur
    form.on('error', function(err) {
      console.log('An error has occured: \n' + err);
    });

    // once all the files have been uploaded, send a response to the client
    form.on('end', function() {
      if (propertiesDict["file2"] == null) {
        propertiesDict["file2"] = "";
      }
      if ((propertiesDict["file1"] != null)) {
          var objectDict = {};
          console.log("name at end " + randid+name);
          objectDict["name"] = (randid+propertiesDict["file1"].split('.')[0]);
          objectDict["properties"] = propertiesDict;
          var collection = database.collection('blocks');
          collection.findOne({"name":"starterplace"}, function(error,document) {
            if (document == null) {
              res.writeHead(405, {})
              res.end()
              return;
            }
            var objects = document["objects"];
            objects.push(objectDict);
            document["objects"] = objects;
            collection.update({"name":"starterplace"}, document, function(error,result) {
              io.sockets.emit('model-declared', {})
              res.writeHead(200, {})
              res.end()
            });
          });
      }
      console.log("end /add-asset");
    });

    form.parse(req, function(err, fields, files) {
      var objectEntry = {};
      // console.log("received " + files);
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
      }
      // console.log(fields);
      console.log(files);
      name = fields["name"];
      console.log("file name " + name);

    })
})

// var p2pserver = require('http').Server
var io = require('socket.io')(server)

server.listen(3003, function () {
  console.log('Listening on all:3003')
})

// Connection URL
var url = 'mongodb://127.0.0.1:27017/webverse';
// Use connect method to connect to the Server
MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server");
  database = db;
});

var connectedPeers = 0;
var datagramQueue = [];
var datagramMap = {};
var peerJSIdList = [];
var datagramTick = setInterval(function() {
  var socketsMap = io.sockets.sockets;
  for (var socketID in socketsMap) {
    var socket = socketsMap[socketID];
    for (var socketMapID in datagramMap) {
      if (socketID !== socketMapID) {
        socket.emit('avatar-datagram', datagramMap);
      }
    }
  }

  datagramQueue = [];
  datagramMap = {};
}, 100)

function printDate() {
  var date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
  return date + " || ";
}

var worldPopulation = {};

io.on('connection', function (socket) {
  connectedPeers += 1;
  var socketidLocal = socket.id;
  var peerjsidlocal;
  var collectedPopulation = false;
  var currentPlace = "";
  socket.emit('server-ack-connect', {'socket_id':socket.id})
  socket.on('avatar-phone-advertise', function(data) {
      data['socketid'] = socket.id;
      socket.broadcast.emit('avatar-audible', data)
  })
  console.log(printDate() + "\x1b[33m" + connectedPeers + "\x1b[0m" + " peers online -- \x1b[1mCONNECT!\x1b[0m " + socket.id + "  \x1b[2mvector > " + socket.request.headers['referrer']  + "----\x1b[33m" + socket.request.headers['host'] + "\x1b[0m\x1b[2m using " +  socket.request.headers['user-agent'] + " language " + socket.request.headers['accept-language'] + "\x1b[0m");
  // slack emoji
  if (connectedPeers > 5) {
    // slack.webhook({
    //   channel: "#memeverse-reporting",
    //   username: "Daemon of the Gate",
    //   icon_emoji: ":ghost:",
    //   text: ":ghost: Gate Daemon says: User connected, " + connectedPeers + " active"
    // }, function(err, response) {
    //   if (err) {
    //       console.log(response);
    //   }
    // });
  }
  socket.on('peerjs-connect-id', function (data) {})

  socket.on('start-stream', function (data) {
    console.log('Stream started')
    socket.broadcast.emit('start-stream', data)
  })
  socket.on('avatar-face', function (data) {
    socket.broadcast.emit('avatar-face', data)
  })
  socket.on('model-updated', function (data) {
    socket.broadcast.emit('model-updated', data)
  })
  socket.on('model-declared', function (data) {
    socket.broadcast.emit('model-declared', data)
  })
  socket.on('avatar-datagram', function (data) {
    if (!collectedPopulation) {
      collectedPopulation = true;
      currentPlace = data['place'];
      if (currentPlace != null) {
        var population = worldPopulation[currentPlace];
        if (population != null) {
          population += 1;
          worldPopulation[currentPlace] = population;
        } else {
          worldPopulation[currentPlace] = 1;
        }
      }
      io.sockets.emit('worldPopulation', worldPopulation);
    }
    datagramMap[socket.id] = data;
    // datagramQueue.push(data);
  })
  socket.on('avatar-sound', function(data) {
    socket.broadcast.emit('avatar-sound', data);
  })
  socket.on('avatar-utterance', function(data) {
    try {
          console.log("\x1b[33m" + socket.request.headers['host'] + "\x1b[0m says " + "\"" + utterance + "\""  + " \x1b[2using " +  socket.request.headers['user-agent'] + " language " + socket.request.headers['accept-language'] + "\x1b[0m");
      }
      catch(err) {
          console.log("oops");
      }
    socket.broadcast.emit('avatar-utterance', data);
  })
  socket.on('disconnect', function(data) {
    if (peerjsidlocal != null) {
      if (peerJSIdList.indexOf(peerjsidlocal) != -1)
        peerJSIdList = peerJSIdList.splice(peerJSIdList.indexOf(peerjsidlocal),1)
    }
    connectedPeers -= 1;
    console.log(printDate() + "\x1b[33m" + connectedPeers + "\x1b[0m" + " peers online -- \x1b[1mDISCONNECT!\x1b[0m " + "\x1b[0m\x1b[2m" + socket.request.headers['host'] + "\x1b[0m");
    // slack emoji
    if (connectedPeers > 5){
      // slack.webhook({
      //   channel: "#memeverse-reporting",
      //   username: "Daemon of the Gate",
      //   icon_emoji: ":ghost:",
      //   text: ":skull: Gate Daemon says: User disconnected, " + connectedPeers + " active"
      // }, function(err, response) {
      //   if (err) {
      //       console.log(response);
      //   }
      // });
    }
    if (currentPlace != null) {
      var population = worldPopulation[currentPlace];
      if (population != null) {
        population -= 1;
        worldPopulation[currentPlace] = population;
      }
    }
    io.sockets.emit('avatar-disconnect', {"socket_id":socketidLocal});
    io.sockets.emit('worldPopulation', worldPopulation);
  });
  socket.on('d', function (data) {
    console.log("audio data received");
  		data["sid"] = socket.id;
  		//console.log(data["a"]);
  		socket.broadcast.emit('d', data); //Send to all but the sender
  		//io.emit("d", data); //Send to all clients (4 debugging)
  });
  socket.on('pcm-chunk', function(data) {
    socket.broadcast.emit('pcm-chunk', data);
  })
})
