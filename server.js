console.log('----- Recover Now Backend -----');

//Load config
var config = require('./config.json');

//Load modules & libraries
var fs = require('fs');
var lib = require('./lib').lib;

//Setup web & socket.io
var web;
(function () {
    //Load templates
    var templates = {};
    var loadTemplates = function () {
        var items = fs.readdirSync(__dirname + '/templates');

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var spl = item.split('.');
            var bld = spl[0];
            for (var j = 1; j < spl.length - 1; j++) {
                bld += '.' + spl[j];
            }
            templates['%' + bld.toUpperCase() + '%'] = fs.readFileSync(__dirname + '/templates/' + item, 'utf8');
        }
    };
    loadTemplates();

    var app = require('express')();
    var http = require('http').Server(app);
    var io = require('socket.io')(http);
    var bodyParser = require('body-parser');
    var session = require('express-session');
    var formidable = require('formidable');
    var mime = require('mime');
    var geoip = require('geoip-lite');

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

        if (config.forceReloadTemplates) {
            loadTemplates();
        }

        console.log(url,lib.getIp(req));

        if (!session.geo) {
            session.geo = geoip.lookup(lib.getIp(req));
            console.log(session.geo);
        }

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

                var sendData = function (dat) {
                    if (url.endsWith('.html')) {
                        var keys = Object.keys(templates);
                        for (var i = 0; i < keys.length; i++) {
                            dat = dat.replace(new RegExp(keys[i], 'g'), templates[keys[i]]);
                        }
                        res.setHeader('Content-Type', mime.getType(path));
                        res.send(dat);
                    } else {
                        res.sendFile(path);
                    }
                };

                if (replace[url]) {
                    replace[url](data, sendData);
                } else {
                    sendData(data);
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
                                phoneNumber: phone,
                                helpRequest: 0
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

    app.post('/addresource', function (req, res) {
        var session = req.session;

        sess.verifySession(session.ourId, function (uid) {
            if (!uid) {
                return res.redirect('/index.html');
            }


        });
    });

    app.post('/ineedhelp', function (req, res) {
        var lat = req.body.latitude;
        var lon = req.body.longitude;

        if (!lat || !lon) {
            return res.redirect('/dashboard.html');
        }

        var session = req.session;

        sess.verifySession(session.ourId, function (uid) {
            if (!uid) {
                return res.redirect('/dashboard.html');
            }
            recover.updateHelpRequest(uid, lat, lon);
            return res.redirect('/dashboard.html');
        })
    });

    io.on('connection', function (socket) {
        socket.join('myroom');

        recover.getHeatmapData(function (array) {
            socket.emit('heatmapData', array);
        });
    });

    var latestHeatmapData;
    var heatmapDataUpdated = false;
    setInterval(function () {
        if (heatmapDataUpdated) {
            heatmapDataUpdated = false;
            io.to('myroom').emit('heatmapData', latestHeatmapData);
        }
    }, 1000);

    web = {
        start: function () {
            http.listen(config.port, function () {
                console.log('Listening on *:' + config.port);
            });
        },
        broadcastHeatmapData: function (map) {
            latestHeatmapData = map;
            heatmapDataUpdated = true;
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
            fb.getUniqueKey(64, config.firebase.sessionPath, function (sessionId) {
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
        },
        getUniqueKey: function (len, parentPath, callback) {
            var id = lib.randomString(len);

            //Check that this sessionId isn't being used
            fb.ref(parentPath + id).once('value', function (snap) {
                if (snap.val()) {
                    fb.getUniqueKey(len, parentPath, callback);
                } else {
                    callback(id);
                }
            });
        }
    };

    //Clear all old sessions
    fb.ref('/RFSession').remove();
})();

//Main data api
var recover;
(function () {
    var formatHeatmapData = function (users) {
        if (!users) {
            return [];
        }

        var map = {};

        var userIds = Object.keys(users);
        for (var i = 0; i < userIds.length; i++) {
            var user = users[userIds[i]];

            if (lib.now() - user.helpRequest < config.heapmapDataExpire * 60 * 1000) {
                map[userIds[i]] = {
                    latitude: user.latitude,
                    longitude: user.longitude
                };
            }
        }

        return map;
    };

    fb.ref(config.firebase.userPath).on('value', function (snap) {
        web.broadcastHeatmapData(formatHeatmapData(snap.val()));
    });

    recover = {
        addResource: function (uid, cityId, title, content, category) {
            fb.getUniqueKey(20, config.firebase.resourcePath, function (resourceId) {
                fb.ref(config.firebase.resourcePath + resourceId).set({
                    title: title,
                    content: content,
                    poster: uid,
                    category: category,
                    cityId: cityId
                });
                var dat = {};
                dat[resourceId] = true;
                fb.ref(config.firebase.locationPath + cityId + '/resources').update(dat);
            });
        },
        addRecoveryArea: function (uid, cityId, title, content) {
            fb.getUniqueKey(20, config.firebase.recoveryPath, function (recoveryId) {
                fb.ref(config.firebase.recoveryPath + recoveryId).set({
                    title: title,
                    content: content,
                    poster: uid,
                    cityId: cityId,
                    category: 0
                });
                var dat = {};
                dat[recoveryId] = true;
                fb.ref(config.firebase.locationPath + cityId + '/recoveryAreas').update(dat);
            });
        },
        updateHelpRequest: function (uid, lat, lon) {
            fb.ref(config.firebase.userPath + uid).update({
                helpRequest: lib.now(),
                latitude: lat,
                longitude: lon
            });
        },
        getHeatmapData: function (callback) {
            fb.ref(config.firebase.userPath).once('value', function (snap) {
                callback(formatHeatmapData(snap.val()));
            });
        }
    };
})();

/*
for (var i = 0; i < 5; i++) {
    recover.addResource('POSTER_' + lib.randomString(10),
        'US-GA-Atlanta',
        'TITLE_' + lib.randomString(5),
        'CONTENT_' + lib.randomString(5),
        Math.floor(Math.random() * 5));
    recover.addRecoveryArea('POSTER_' + lib.randomString(10),
        'US-GA-Atlanta',
        'TITLE_' + lib.randomString(5),
        'CONTENT_' + lib.randomString(5));
}
*/
/*
for (var i = 0; i < 900; i++) {
    fb.getUniqueKey(28, config.firebase.userPath, function (uid) {
        fb.ref(config.firebase.userPath + uid).set({
            email: 'boi@boi.boi',
            firstName: 'boi',
            lastName: 'boi',
            helpRequest: 0,
            phoneNumber: '123456790'
        });
    });
}*/

function randomLatLng() {
    return {
        latitude: 33.748995 - Math.pow(Math.random()*1-.5, 3),
        longitude: -84.387982 + Math.pow(Math.random()*1-.5, 3)
    };
}
/*
fb.ref(config.firebase.userPath).once('value', function (snap) {
    var users = snap.val();
    var userIds = Object.keys(users);
    for (var i = 0; i < userIds.length; i++) {
        var latlng = randomLatLng();
        recover.updateHelpRequest(userIds[i], latlng.latitude, latlng.longitude);
    }
});*/
/*
fb.ref(config.firebase.resourcePath).once('value', function (snap) {
    var arr = snap.val();
    var ids = Object.keys(arr);
    for (var i = 0; i < ids.length; i++) {
        fb.ref(config.firebase.resourcePath + ids[i]).update(randomLatLng());
    }
});*/

//Update poster ids
/*
fb.ref(config.firebase.userPath).once('value', function (snap) {
    var users = snap.val();
    var userIds = Object.keys(users);
    fb.ref(config.firebase.recoveryPath).once('value', function (snap) {
        var arr = snap.val();
        var ids = Object.keys(arr);
        for (var i = 0; i < ids.length; i++) {
            fb.ref(config.firebase.recoveryPath + ids[i]).update({
                poster: userIds[Math.floor(Math.random() * userIds.length)]
            });
        }
    });
});*/

//Start web
web.start();