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
    var session = require('express-session');
    var formidable = require('formidable');

    //Setup middleware
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());
    app.use(session({
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: true,
        cookie: {secure: false}
    }));

    var needAuth = ['/dashboard.html'];

    app.get('/profilepic', function (req, res) {
        var email = req.query.email;
        fb.emailToUser(email, function (data) {
            if (data.err) {
                res.send('Invalid email');
            } else {
                fb.getFileStream(config.firebase.userPath + data.uid).pipe(res);
            }
        });
    });

    app.get('*', function (req, res) {
        var session = req.session;

        var url = req.url.split('?')[0];
        if (url === '/')url += 'index.html';

        sess.verifySession(session.ourId, function (uid) {
            if (!uid && needAuth.indexOf(url) >= 0) {
                return res.redirect('/index.html');
            }

            if (uid && url == '/index.html') {
                return res.redirect('/dashboard.html');
            }

            var path = __dirname + '/public/' + url;
            try {
                fs.accessSync(path, fs.F_OK);
            } catch (e) {
                path = __dirname + '/public/err404.html';
            }

            var replace = {
                '/dashboard.html': function (str, callback) {
                    fb.ref(config.firebase.userPath + uid ).once('value', function (snap) {
                        str = str.replace(/%SERVERDATA%/g, JSON.stringify(snap.val()));
                        callback(str);
                    });
                }
            };

            fs.readFile(path, 'utf8', function (err, data) {
                if (err) {
                    return console.trace(err);
                }

                if (replace[url]) {
                    replace[url](data, function (newData) {
                        res.send(newData);
                    });
                } else {
                    res.sendFile(path);
                }
            });
        });
    });

    app.post('/register', function (req, res) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) {
                console.trace(err);
                return res.redirect('/index.html?msg=An error has occurred');
            }
            var firstName = fields.fname;
            var lastName = fields.lname;
            var email = fields.email;
            var phone = fields.phone;
            var pass = fields.password;
            var profilePic = files.profilePic;

            var resolve = function (msg) {
                res.redirect('/index.html?msg=' + msg);
            };

            if (!firstName || firstName.length == 0) {
                return resolve('First name cannot be left blank');
            }

            if (!lastName || lastName.length == 0) {
                return resolve('Last name cannot be left blank');
            }

            if (!email || email.length == 0) {
                return resolve('Email cannot be left blank');
            }

            if (!phone || phone.length == 0) {
                return resolve('Phone number cannot be left blank');
            }

            if (!pass || pass.length < 6) {
                return resolve('Invalid password');
            }

            if (!profilePic) {
                return resolve('Invalid profile picture');
            }

            fb.register(email, pass, function (data) {
                if (data.err) {
                    return resolve(data.err.message);
                } else {
                    fb.uploadFile(config.firebase.userPath + data.uid, profilePic, function (dat) {
                        if (dat.err) {
                            return resolve('Could not upload profile pic');
                        } else {
                            fb.ref(config.firebase.userPath + data.uid).set({
                                firstName: firstName,
                                lastName: lastName,
                                email: email,
                                phoneNumber: phone
                            });
                            return resolve('Registration success! Please login');
                        }
                    });
                }
            });
        });
    });

    app.post('/login', function (req, res) {
        var session = req.session;

        var email = req.body.email;
        var pass = req.body.password;

        var resolve = function (msg) {
            res.redirect('/index.html?msg=' + msg);
        };

        fb.login(email, pass, function (data) {
            if (data.err) {
                return resolve(data.err.message);
            } else {
                sess.createSession(data.uid, function (sessionId) {
                    session.ourId = sessionId;
                    res.redirect('/dashboard.html');
                });
            }
        });
    });

    app.post('/logout', function (req, res) {
        req.session.destroy();
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
        fb.ref(config.firebase.sessionPath + id).once('value', function (snap) {
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
                fb.ref(config.firebase.sessionPath + sessionId).set(uid);
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
            fb.ref(config.firebase.sessionPath + sessionId).once('value', function (snap) {
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
            fb.ref(config.firebase.sessionPath + sessionId).remove();
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
        databaseURL: "https://recover-now.firebaseio.com",
        storageBucket: "recover-now.appspot.com"
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

    var gcloud = require('gcloud');
    var storage = gcloud.storage({
        projectId: 'recover-now',
        keyFilename: 'serviceAccountKey.json'
    });
    var bucket = storage.bucket('recover-now.appspot.com');

    var formatFilePath = function (path) {
        if (path.startsWith('/')) {
            path = path.substring(1);
        }
        return path;
    };

    fb = {
        register: function (email, pass, callback) {
            firebase.auth().createUser({
                email: email,
                password: pass
            }).then(function (data) {
                callback({uid: data.uid});
            }, function (err) {
                console.trace('registerError', err);
                callback({err: err.errorInfo});
            });
        },
        login: function (email, pass, callback) {
            client.auth().signInWithEmailAndPassword(email, pass).then(function (data) {
                callback({uid: data.uid});
            }, function (err) {
                console.trace('loginError', err);
                callback({err: err});
            });
        },
        ref: function (path) {
            return firebase.database().ref(path);
        },
        uploadFile: function (path, file, callback) {
            path = formatFilePath(path);
            return bucket.upload(file.path, {destination: path}, function (err, file, apiResponse) {
                if (err) {
                    console.trace(err);
                    return callback({err: err});
                }
                callback({success: true});
            });
        },
        getFileStream: function (path) {
            path = formatFilePath(path);
            return bucket.file(path).createReadStream();
        },
        emailToUser: function (email, callback) {
            firebase.auth().getUserByEmail(email).then(function (data) {
                callback({uid: data.uid});
            }, function (err) {
                callback({err: err.errorInfo});
            })
        }
    };

    //Clear all old sessions
    fb.ref('/RFSession').remove();
})();

//Test data
var test;
(function () {
    test = {
        addResourceToCity: function (cityId, resourceData) {
            var resourceId = lib.randomString(20);
            fb.ref(config.firebase.resourcePath + resourceId).set(resourceData);
            var dat = {};
            dat[resourceId] = true;
            fb.ref(config.firebase.locationPath + cityId + '/resources').update(dat);
        },
        addRecoveryToCity: function (cityId, recoveryData) {
            var recoveryId = lib.randomString(20);
            fb.ref(config.firebase.recoveryPath + recoveryId).set(recoveryData);
            var dat = {};
            dat[recoveryId] = true;
            fb.ref(config.firebase.locationPath + cityId + '/recoveryAreas').update(dat);
        }
    };
})();

/*
for (var i = 0; i < 5; i++) {
    test.addResourceToCity('USA-GA-Atlanta', {
        title: 'TITLE_' + lib.randomString(5),
        content: 'CONTENT_' + lib.randomString(5),
        poster: 'POSTER_' + lib.randomString(10),
        category: Math.floor(Math.random() * 5)
    });
}
*/

//Start web
web.start();