var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var lessons = [];

app.get('/lessons', function(req, res) {
  res.send(JSON.stringify(lessons));
});

app.post('/lessons', function(req, res) {
  var uid = generateUID();
  lessons.push(uid);
  io.sockets.emit('create', uid);
  res.send(uid);
});

io.sockets.on('connection', function(socket) {
  socket.on('create', function(room) {
    socket.join(room);
  });
});

http.listen(9001, function() {
  console.log('Listening on: localhost:9001');
});

function generateUID() {
    var a = (Math.random() * 46656) | 0;
    var b = (Math.random() * 46656) | 0;
    a = ("000" + a.toString(36)).slice(-3);
    b = ("000" + b.toString(36)).slice(-3);
    return a + b;
}
