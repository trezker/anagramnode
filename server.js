var http = require('http');
var express = require('express');
var cookieparser = require('cookie-parser');
var session = require('express-session')
var jade = require('jade');
var cookie = require('cookie');
var connect = require('connect');
var mysql = require("mysql");

var db = mysql.createConnection({
	host     : '127.0.0.1',
	user     : 'anagram',
	password : 'test',
	database : 'anagram'
});

var app = express();
var server = http.createServer(app);
io = require('socket.io').listen(server);
server.listen(1337);

var dictionary = [];
var scrambledword = "";
var correctword = '';
var shuffletimeout = null;
var start = null;

String.prototype.shuffle = function () {
    var a = this.split(""),
        n = a.length;

    for(var i = n - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a.join("");
}

function scramble_random_word() {
	if(shuffletimeout != null) {
		clearTimeout(shuffletimeout);
	}
	
	correctword = dictionary[Math.floor(Math.random() * (dictionary.length + 1))];
	scrambledword = correctword.shuffle();
	console.log("Picked word: " + correctword);
	console.log("Scrambled word: " + scrambledword);

	io.sockets.emit('set_scrambled', {
		scrambledword: scrambledword
	});

	start = Date.now();
	io.sockets.emit('set_timeleft', {
		timeleft: 40
	});

	shuffletimeout = setTimeout(
		function() {
			io.sockets.emit('event', {
				message: "Time's up, the word was: " + correctword
			});
			scramble_random_word();
		},
		40000
	);

	setInterval(
		function() {
			var now = Date.now();
			var diff = now - start;
			io.sockets.emit('set_timeleft', {
				timeleft: Math.floor(40 - (diff / 1000))
			});
		},
		1000
	);
}

var lineReader = require('line-reader');
lineReader.eachLine("words", function(line, last) {
	if(!(line.indexOf("'") > -1))
		dictionary.push(line);
	if(last){
		console.log("Loaded dictionary: " + dictionary.length + " words.");
		scramble_random_word();
	}
});

//Session
var sessionMiddleware = session({
    secret: "jJmn5r8Hb4uy7dhj"
});

io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

app.use(cookieparser());
app.use(sessionMiddleware);

//Express setup
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
	//console.log(req.session.test);
	req.session.test = 'express session';
	res.render('home.jade');
});

//Websocket
io.sockets.on('connection', function (socket) {
	socket.on('set_username', function (data) {
		db.query("call create_user(?);", [data], function(err, results) {
			if(err != null) {
				console.log("DB ERROR: create_user: " + err);
			}
			else {
				db.query("call get_user_id_by_name(?);", [data], function(err, result, fields) {
					if(err != null) {
						console.log("DB ERROR: get_user_id_by_name: " + err);
					}
					else if(result[0].length == 0) {
						console.log("DB ERROR: get_user_id_by_name return 0 rows: " + data);
					}
					else {
						socket.user_id = result[0][0].ID;
						socket.username = data;
						socket.broadcast.emit('event', {
							message: 'user joined : ' + socket.username
						});
						
						socket.emit('set_scrambled', {
							scrambledword: scrambledword
						});

						db.query("call get_highscore();", function(err, result, fields) {
							if(err != null) {
								console.log("DB ERROR: get_highscore: " + err);
							}
							else {
								socket.emit('set_highscore', {
									highscore: result[0]
								});
							}
						});
					}
				});				
			}
		});
	});

	socket.on('message', function (message) {
		var name = socket.username;
		var data = { 'message' : message, username : name };
		io.sockets.emit('message', data);
		console.log("user " + name + " sent this : " + message);
		
		if(message.toLowerCase() === correctword.toLowerCase()) {
			db.query("call create_solve(?, ?);", [socket.user_id, correctword], function(err, results) {
				if(err != null) {
					console.log("DB ERROR: create_solve: " + err);
				}
				else {
					io.sockets.emit('event', {
						message: name + ' is correct: ' + correctword
					});
					scramble_random_word();
					db.query("call get_highscore();", function(err, result, fields) {
						if(err != null) {
							console.log("DB ERROR: get_highscore: " + err);
						}
						else {
							io.sockets.emit('set_highscore', {
								highscore: result[0]
							});
						}
					});
				}
			});
		}
	});

	socket.on('disconnect', function () {
		if(socket.username) {
			socket.broadcast.emit('event', {
				message: 'user left : ' + socket.username
			});
		}
	});
});
