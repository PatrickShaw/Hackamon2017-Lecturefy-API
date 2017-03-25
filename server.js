let app = require('express')();
let http = require('http').Server(app);
let io = require('socket.io').listen(1337);
let PDFImage = require("pdf-image").PDFImage;
let fs = require('fs');
let path = require('path');

// AWS
let AWS = require('aws-sdk');
AWS.config.loadFromPath('./data/config.json');

let BUCKET_NAME = "hackamon-pineapple";

let lessons = [];
let lesson_data = {};
let questions = [
    {
        id: 0, // PLEASE NOTE THAT THE IDS ARE REGENERATED SOMEWHERE ELSE
        description: "Do you think Pineapple Bae should win Hackamon? ;)",
        answers: [
            {
                id: 1,
                description: "yes"
            },
            {
                id: 2,
                description: "definately yes",
            }
        ],
        correct_answer: 2,
    },
    {
        id: 3,
        description: "What is our team name?",
        answers: [
            {
                id: 4,
                description: "Pineapple Bae"
            },
            {
                id: 5,
                description: "Pineapple Bay"
            },
            {
                id: 6,
                description: "Pineapples Under the Sea",
                explanation: "That was our previous team name!"
            }
        ]
    }
];
let slides = [
    {}
]
uid = 0;
questions.forEach(function(question, index) {
    question.id = uid++;
    question.answers.forEach(function(answer, answer_index) {
        answer.id = uid++;
        answer.poll_count = 0;
        answer.answer_audit = [];
        console.log(answer);
    });
    console.log(question);
});
slides.forEach(function(slide, index) {
    slide.id = uid++;
    slide.presenter_slide_index = 0;
});
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
app.get('/questions', function(req, res) {

})
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

       if (fs.existsSync("./data/local-tmp/dsquire-" + i + ".png")) {
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
              lesson_data[lesson_id] = {slides: slide_urls};
              res.send("Uploaded.")
            }
          });  // After this is async.
        });
      });
    });
});
function findQuestion(searched_id) {
    let selected_question = null;
    questions.some((question)=>{
        let found_question = question.id == searched_id;
        if (found_question) {
            selected_question = question;
        }
        return found_question;
    });
    return selected_question;
}
function findAnswer(searched_id, question) {
    let selected_answer = null;
    question.answers.some((answer)=>{
        let found_answer = answer.id == searched_id;
        if(found_answer) {
            selected_answer = answer;
        }
        return found_answer;
    })
    return selected_answer;
}
function findUsername(username, answer) {
    let selected_username_index = null;
    answer.answer_audit.some((audit, index) => {
        let found_username = audit.username == username;
        if(found_username) {
            selected_username_index = index;
        }
        return found_username;
    })
    return selected_username_index;
}
io.sockets.on('connection', function(socket) {
    socket.on('start_question', function(partial_question)) {
        question = findQuestion(partial_question.id);
        if(question == null) {
            console.log(`question ${partial_question_id} was null`);
            return;
        }
        io.sockets.emit('show_question', question);
    }
    socket.on('onSlideIndexChanged', function(partial_slide_information){
        try {
            if (partial_slide_information.is_presenter) {
                io.sockets.emit('onPresenterSlideIndexChanged', {slide_index: partial_slide_information.slide_index});
            }
        } catch(err) {
            console.log(err);
        }
    });
    socket.on('answer_question', function (data) {
        question = findQuestion(data.question_id);
        if (question == null) {
            socket.emit('exception', {errorMessage: "Question was null"});
            console.log(`Question ${data.question_id} does not exist`);
            return;
        }
        question.answers.forEach((answer) => {
            let selected_username_index = findUsername(data.username, answer);
        let should_emit = false;
        if (answer.id == data.answer_id) {
            if (selected_username_index == null) {
                answer.poll_count += 1;
                answer.answer_audit.push({username: data.username});
                should_emit = true;
            }
        } else {
            if (selected_username_index != null) {
                answer.poll_count -= 1;
                answer.answer_audit.splice(selected_username_index, 1);
                should_emit = true;
            }
        }
        if (should_emit) {
            socket.emit('answer_update', {
                question_id: question.id,
                answer: {id: answer.id, poll_count: answer.poll_count}
            });
        }
    })
        ;
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
