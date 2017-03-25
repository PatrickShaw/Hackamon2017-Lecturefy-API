var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var PDFImage = require("pdf-image").PDFImage;
var fs = require('fs');
var path = require('path');

// AWS
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./data/config.json');

let BUCKET_NAME = "hackamon-pineapple";


var lessons = [];
var lesson_data = {};

app.get('/lessons', function(req, res) {
  res.send(JSON.stringify(lessons));
});

app.post('/lessons', function(req, res) {
  var uid = generateUID();
  lessons.push(uid);
  io.sockets.emit('create', uid);
  res.send(uid);
});

app.post('/lessons/:lesson/upload', function(req, res) {
  // TODO: David's part
  // TODO: 0. locally process all images form pdf. [Done]
  // TODO: 1. upload pdf slides as images to FS.
  // TODO: 2. return array of url/path/.../images

  // TODO: Get pdf from front end.
  let pdf_path = "./data/dsquire.pdf";
  let data_out_path = "./data/out/";
  let options = {
    "outputDirectory": data_out_path
  };

  let pdf_file = new PDFImage(pdf_path, options);

  // Promise.
  pdf_file.getInfo().then(function (pdf_info) {
    let len_pages = pdf_info["Pages"];
    for (var i = 0; i < len_pages; i++) {
       // TODO: Implement filesystem.
       if (fs.existsSync("/Users/David/Desktop/hackamon2017/backend/twitchedu-backend/data/out/dsquire-" + i + ".png")) {
         console.log("Already exists: " + "dsquire-" + i  + ".png");
       } else {
         // Promise.
         console.log("Converting: " + "dsquire-" + i + ".png");
         pdf_file.convertPage(i).then(function (image_path) {
           console.log("")
         }, function(err) {
           console.log(err);
         });

       }
    }
  });

  // S3 cloud storage.

  s3 = new AWS.S3({apiVersion: '2006-03-01'});  // Create S3 service object
  var uploadParams = {Bucket: BUCKET_NAME, Key: '', Body: ''};

  // TODO: Loop over all files when ready.
  var file_path = "./data/out/dsquire-0.png";
  var filestream = fs.readFileSync(file_path);
  uploadParams.Body = filestream;
  console.log(filestream);

  uploadParams.Key = path.basename(file_path);  // Returns filename.ext from path/to/file/filename.ext.

  // call S3 to retrieve upload file to specified bucket
  s3.upload (uploadParams, function (err, data) {
    if (err) {
      console.log("Error", err);
    } if (data) {
      console.log("Upload Success", data.Location);
    }
  });

  var lesson_id = req.params.lesson; // lesson_data[lesson].slides = ["../1.png", "../2.png"];

});

io.sockets.on('connection', function(socket) {
  socket.on((json)=>{
    socket.emit({value: json.value + 1});
  })
});

http.listen(9001, function() {
  console.log('Listening on: http://localhost:9001/');
});

function generateUID() {
    var a = (Math.random() * 46656) | 0;
    var b = (Math.random() * 46656) | 0;
    a = ("000" + a.toString(36)).slice(-3);
    b = ("000" + b.toString(36)).slice(-3);
    return a + b;
}
