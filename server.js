let app = require('express')();
let http = require('http').Server(app);
let io = require('socket.io')(http);
let PDFImage = require("pdf-image").PDFImage;
let fs = require('fs');
let path = require('path');

// AWS
let AWS = require('aws-sdk');
AWS.config.loadFromPath('./data/config.json');

let BUCKET_NAME = "hackamon-pineapple";


let lessons = [];
let lesson_data = {};

app.get('/lessons', function(req, res) {
  res.send(JSON.stringify(lessons));
});

app.post('/lessons', function(req, res) {
  let uid = generateUID();
  lessons.push(uid);
  io.sockets.emit('create', uid);
  res.send(uid);
});

function png_slide_url_comparison(a, b) {
  var get_slide_no_regex = /([a-zA-Z0-9_://\.]*)-([a-zA-Z0-9_://\.]*)-(\d*).png/;  // Group 3 = \d*
  var a_match = get_slide_no_regex.exec(a);
  var index_slide_a = parseInt(a_match[3]);
  var b_match = get_slide_no_regex.exec(b);
  var index_slide_b = parseInt(b_match[3]);

  if (index_slide_a <  index_slide_b) {
    return -1;
  }
  if (index_slide_a > index_slide_b) {
    return 1;
  }
  // a must be equal to b
  return 0;
}

app.post('/lessons/:lesson/upload', function(req, res) {
  let lesson_id = req.params.lesson; // lesson_data[lesson].slides = ["../1.png", "../2.png"];
  let slide_urls = [];

  // TODO: David's part
  // TODO: 0. locally process all images form pdf. [Done]
  // TODO: 1. upload pdf slides as images to FS. [Done]
  // TODO: 2. return array of url/path/.../images [Done]
  // TODO: x. Get pdf from S3 from front end.

  // TODO: Get pdf from front end.
  let pdf_path = "./data/dsquire.pdf";
  let data_out_path = "./data/local-tmp/";
  let options = {
    "outputDirectory": data_out_path
  };

  let pdf_file = new PDFImage(pdf_path, options);
  // Promise.
  pdf_file.getInfo().then(function (pdf_info) {
    let len_pages = parseInt(pdf_info["Pages"]);
    let promises = [];
    for (let i = 0; i < len_pages; i++) {
       // TODO: Implement filesystem.
       if (fs.existsSync("/Users/David/Desktop/hackamon2017/backend/twitchedu-backend/data/local-tmp/dsquire-" + i + ".png")) {
         console.log("Already exists: " + "dsquire-" + i  + ".png");
       } else {
         // Promise.
         console.log("Converting: " + "dsquire-" + i + ".png");
         promises.push(
           pdf_file.convertPage(i).catch(error => {
             console.log(error);
           })
         );
       }
    }
    Promise.all(promises).then(
      wrote_pngs => {
        console.log("Wrote: " + wrote_pngs); // All write png promises finished.
        // S3 cloud storage.
        s3 = new AWS.S3({apiVersion: '2006-03-01'});  // Create S3 service object
        let uploadParams = {Bucket: BUCKET_NAME, Key: '', Body: ''};
        let count = 0;

        fs.readdirSync(data_out_path).forEach(function(filename) {
          let relative_file_path = data_out_path + filename;
          console.log("file: " + filename);
          let filestream = fs.readFileSync(relative_file_path);

          uploadParams.Body = filestream;

          // Note: uploadParams.key = "my-new-path/file.etx" will create the folder my-new-path.
          uploadParams.Key = lesson_id +'/' + path.basename(relative_file_path);  // Returns filename.ext from path/to/file/filename.ext.

          // call S3 to retrieve upload file to specified bucket
          s3.upload (uploadParams, function (err, data) {
            if (err) {
              console.log("Error", err);
            }
            if (data) {
              console.log("Upload Success", data.Location);
              slide_urls.push(data.Location);
            }
            count = count + 1;
            if (count >= len_pages) {
              slide_urls.sort(png_slide_url_comparison);
              console.log("Slides: " + slide_urls);
              room_data[lesson_id].slides = slide_urls;
              res.send("Uploaded.")
            }
          });        // After this is async.
        });
      });
    });
});

io.sockets.on('connection', function(socket) {
  socket.on('create', function(room) {
    socket.join(room);
  });
});

http.listen(9001, function() {
  console.log('Listening on: http://localhost:9001/');
});

function generateUID() {
    let a = (Math.random() * 46656) | 0;
    let b = (Math.random() * 46656) | 0;
    a = ("000" + a.toString(36)).slice(-3);
    b = ("000" + b.toString(36)).slice(-3);
    return a + b;
}
