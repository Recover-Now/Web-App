console.log('----- Recover Now Backend -----');

//Load config
var config = require('./config.json');

//Load modules
var fs = require('fs');

//Setup web & socket.io
var web;
(function () {
    var app = require('express')();
    var http = require('http').Server(app);
    var io = require('socket.io')(http);
    var bodyParser = require('body-parser');

    //Setup middleware
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());


    app.get('*', function (req, res) {
        var url = req.url.split('?')[0];
        if (url === '/')url += 'index.html';
        var path = __dirname + '/public/' + url;
        try {
            fs.accessSync(path, fs.F_OK);
        } catch (e) {
            path = __dirname + '/public/err404.html';
        }

        res.sendFile(path);
    });

    app.post('/register', function (req, res) {
        console.log('register',req.body);
        fb.register(req.body.email, req.body.password);
        res.redirect('/index.html');
    });

    app.post('/login', function (req, res) {
        console.log('login',req.body);
        fb.login(req.body.email, req.body.password);
        res.redirect('/index.html');
    });

    io.on('connection', function (socket) {
        socket.on('test', function (d) {
            console.log(d);
        });
    });

    web = {
        start: function () {
            http.listen(config.port, function () {
                console.log('Listening on *:' + config.port);
            });
        }
    };
})();

//Setup firebase
var fb;
(function () {
    var firebase = require("firebase-admin");
    var serviceAccount = require("./serviceAccountKey.json");

    firebase.initializeApp({
        credential: firebase.credential.cert(serviceAccount),
        databaseURL: "https://recover-now.firebaseio.com"
    });

    var client = require('firebase');
    client.initializeApp({
        apiKey: "AIzaSyDFRwIfwuLYM5n8idbsvqECvRN-BMZKTp4",
        authDomain: "recover-now.firebaseapp.com",
        databaseURL: "https://recover-now.firebaseio.com",
        projectId: "recover-now",
        storageBucket: "recover-now.appspot.com",
        messagingSenderId: "828997879070"
    });

    fb = {
        register: function (email, pass) {
            firebase.auth().createUser({
                email: email,
                password: pass
            }).then(function (data) {
                console.log('gott',data);
            }, function (err) {
                console.log('error',err);
            }).catch(function (err) {
                console.log('caught',err);
            });
        },
        login: function (email, pass) {
            client.auth().signInWithEmailAndPassword(email, pass).then(function (data) {
                console.log('gott',data);
            }, function (err) {
                console.log('err', err);
            }).catch(function (err) {
                console.log('caught',err);
            });
        }
    };
})();

//Start web
web.start();