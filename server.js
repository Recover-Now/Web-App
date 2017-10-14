console.log('----- Recover Now Backend -----');

//Load config
var config = require('./config.json');

//Load modules & libraries
var fs = require('fs');
var lib = require('./lib').lib;

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

//Session handler
var sess;
(function () {
    var sessExpires = {};
    var sessions = [];

    var renewSession = function (sessionId) {
        sessExpires[sessionId] = lib.now() + config.sessionExpire * 1000;
        sessions.push(sessions.splice(sessions.indexOf(sessionId), 1)[0]);
    };

    var getNewSession = function (callback) {
        var id = lib.randomString(64);

        //Check that this sessionId isn't being used
        fb.ref(config.sessionPath + id).once('value', function (snap) {
            if (snap.val()) {
                getNewSession(callback);
            } else {
                callback(id);
            }
        });
    };

    //Check and destroy expired sessions
    setInterval(function () {
        var toDestroy = [];
        for (var i = 0; i < sessions.length; i++) {
            var sessionId = sessions[i];
            if (lib.now() >= sessExpires[sessionId]) {
                toDestroy.push(sessionId);
            }
        }
        while (toDestroy.length > 0) {
            sess.destroySession(toDestroy.pop());
        }
    }, 60 * 1000);

    sess = {
        createSession: function (uid, callback) {
            getNewSession(function (sessionId) {
                fb.ref(config.sessionPath + sessionId).set(uid);
                sessions.push(sessionId);
                renewSession(sessionId);
                callback(sessionId);
            });
        },
        verifySession: function (sessionId, callback) {
            var idx = sessions.indexOf(sessionId);
            if (idx < 0) {
                return callback(false);
            }
            fb.ref(config.sessionPath + sessionId).once('value', function (snap) {
                var val = snap.val();
                if (val) {
                    renewSession(sessionId);
                    callback(val);
                } else {
                    callback(false);
                }
            });
        },
        destroySession: function (sessionId) {
            delete sessExpires[sessionId];
            var idx = sessions.indexOf(sessionId);
            if (idx >= 0) {
                sessions.splice(idx, 1);
            }
            fb.ref(config.sessionPath + sessionId).remove();
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
        },
        ref: function (path) {
            return firebase.database().ref(path);
        }
    };

    //Clear all old sessions
    fb.ref('/RFSession').remove();
})();

//Start web
web.start();