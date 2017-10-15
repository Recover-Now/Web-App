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

    var getIp = function (req) {
        var ip = req.connection.remoteAddress;
        if (ip == '::1' && config.islocal) {
            ip = '128.61.7.129';
        }
        return ip;
    };

    var app = require('express')();
    var http = require('http').Server(app);
    var io = require('socket.io')(http);
    var bodyParser = require('body-parser');
    var session = require('express-session')({
        secret: 'keyboard cat',
        resave: true,
        saveUninitialized: true,
        cookie: {secure: false}
    });
    var sharedsession = require("express-socket.io-session");
    var formidable = require('formidable');
    var mime = require('mime');
    var geoip = require('geoip-lite');

    //Setup middleware
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());
    app.use(session);

    var needAuth = ['/dashboard.html', '/profile.html', '/recoveryAreas.html'];

    app.get('/profilepic', function (req, res) {
        var email = req.query.email;
        fb.emailToUser(email, function (data) {
            if (data.err) {
                fb.getFileStream('/defaultProfilePic.png').pipe(res);
                //res.send('Invalid email');
            } else {
                var path = config.firebase.userPath + data.uid;
                fb.fileExists(path, function (exists) {
                    if (exists) {
                        fb.getFileStream(path).pipe(res);
                    } else {
                        fb.getFileStream('/defaultProfilePic.png').pipe(res);
                    }
                });
            }
        });
    });

    app.get('/apple-app-site-association', function (req, res) {
        var url = req.url.split('?')[0];
        if (url === '/')url += 'index.html';
        var path = __dirname + '/public/' + url;
        try {
            fs.accessSync(path, fs.F_OK);
        } catch (e) {
            path = __dirname + '/public/err404.html';
        }
        res.setHeader('Content-Type', 'application/json');
        res.sendFile(path);
    });

    app.get('*', function (req, res) {
        var session = req.session;

        var url = req.url.split('?')[0];
        if (url === '/')url += 'index.html';

        if (config.forceReloadTemplates) {
            loadTemplates();
        }

        if (!session.geo) {
            var geo = geoip.lookup(getIp(req));
            if (geo) {
                session.geo = geo.country + '-' + geo.region + '-' + geo.city;
            }
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

            var replaceUserInfo = function (str, callback, moreJson) {
                fb.ref(config.firebase.userPath + uid).once('value', function (snap) {
                    var json = snap.val();
                    json.authenticated = true;
                    if (moreJson) {
                        var keys = Object.keys(moreJson);
                        for (var i = 0; i < keys.length; i++) {
                            json[keys[i]] = moreJson[keys[i]];
                        }
                    }
                    str = str.replace(/%SERVERDATA%/g, JSON.stringify(json));
                    callback(str);
                });
            };

            templates['%SIDEBARAUTH%'] = !!uid ? templates['%SIDEBARDASH%']: templates['%SIDEBAR%'];

            var replace = {
                '/dashboard.html': replaceUserInfo,
                '/profile.html': replaceUserInfo,
                '/recoveryAreas.html': replaceUserInfo,
                '/checkinList.html': function (str, callback) {
                    var areaId = req.query.recoveryArea;

                    var checks = [];

                    new Promise(function (resolve, reject) {
                        if (areaId) {
                            recover.getCheckins(areaId, function (dat) {
                                checks = dat;
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    }).then(function () {
                        var moreJson = {
                            authenticated: !!uid,
                            checkins: checks
                        };
                        if (uid) {
                            replaceUserInfo(str, callback, moreJson);
                        } else {
                            str = str.replace(/%SERVERDATA%/g, JSON.stringify(moreJson));
                            callback(str);
                        }
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

    app.post('/updateinfo', function (req, res) {
        var session = req.session;

        var firstName = req.body.fname;
        var lastName = req.body.lname;
        var phone = req.body.phone;

        var resolve = function (msg) {
            res.redirect('/profile.html?msg=' + msg);
        };

        if (!firstName || firstName.length == 0) {
            return resolve('First name cannot be left blank');
        }

        if (!lastName || lastName.length == 0) {
            return resolve('Last name cannot be left blank');
        }

        if (!phone || phone.length == 0) {
            return resolve('Phone number cannot be left blank');
        }

        sess.verifySession(session.ourId, function (uid) {
            if (!uid) {
                return res.redirect('/index.html');
            }

            fb.ref(config.firebase.userPath + uid).update({
                firstName: firstName,
                lastName: lastName,
                phoneNumber: phone
            });

            return res.redirect('/profile.html?msg=Updated Successfully');
        });
    });

    app.post('/changepass', function (req, res) {
        var session = req.session;

        var oldPass = req.body.oldpassword;
        var newPass = req.body.newpassword;

        sess.verifySession(session.ourId, function (uid) {
            if (!uid) {
                return res.redirect('/index.html');
            }

            fb.ref(config.firebase.userPath + uid).once('value', function (snap) {
                var val = snap.val();
                fb.updatePass(val.email, oldPass, newPass, function (data) {
                    if (data.success) {
                        return res.redirect('/profile.html?msg=Updated password successfully');
                    } else {
                        return res.redirect('/profile.html?msg=' + data.err);
                    }
                });
            });
        });
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

    io.use(sharedsession(session, {
        autoSave: true
    }));

    io.on('connection', function (socket) {
        socket.join('myroom');

        socket.on('dashboard', function () {
            var session = socket.handshake.session;

            socket.join('resources' + session.geo);

            recover.getResources(session.geo, function (data) {
                socket.emit('resources', data);
            });
        });

        socket.on('checkin', function (areaId) {
            socket.join('checkin' + areaId);
        });

        fb.ref(config.firebase.recoveryPath).once('value', function (snap) {
            var areas = snap.val();
            var keys = Object.keys(areas);
            var array = [];
            for (var i = 0; i < keys.length; i++) {
                array.push(areas[keys[i]]);
            }
            socket.emit('recoveryAreas', array);
        });

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
        },
        broadcastCheckinData: function (areaId, checks) {
            io.to('checkin' + areaId).emit('checkins', checks);
        },
        broadcastResources: function (geo, data) {
            io.to('resources' + geo).emit('resources', data);
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
        updatePass: function (email, oldPass, newPass, callback) {
            console.log(email, oldPass);
            client.auth().signInWithEmailAndPassword(email, oldPass).then(function (data) {
                client.auth().currentUser.updatePassword(newPass).then(function (data) {
                    callback({success: true});
                }, function (err) {
                    console.trace(err);
                    callback({err: err});
                });
            }, function (err) {
                callback({err: 'Wrong old password'});
            }).catch(function (err) {
                console.trace(err);
                callback({err: 'Wrong old password'});
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
        fileExists: function (path, callback) {
            path = formatFilePath(path);
            bucket.file(path).exists(function (err, data) {
                if (err) {
                    console.trace(err);
                    return callback(false);
                }

                callback(data);
            });
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

    //Listen to checkin changes
    var checkinListen = [];
    fb.ref(config.firebase.locationCheckIn).on('value', function (snap) {
        var areas = snap.val();
        var areaIds = Object.keys(areas);
        for (var i = 0; i < areaIds.length; i++) {
            const areaId = areaIds[i];
            if (checkinListen.indexOf(areaId) < 0) {
                checkinListen.push(areaId);
                fb.ref(config.firebase.locationCheckIn + areaId).on('value', function (snap) {
                    recover.getCheckins(areaId, function (checks) {
                        web.broadcastCheckinData(areaId, checks);
                    });
                })
            }
        }
    });

    //Listen to resource changes
    var resourceListen = [];
    fb.ref(config.firebase.locationPath).on('value', function (snap) {
        var locs = snap.val();
        var locIds = Object.keys(locs);
        for (var i = 0; i < locIds.length; i++) {
            const locId = locIds[i];
            if (resourceListen.indexOf(locId) < 0) {
                resourceListen.push(locId);
                fb.ref(config.firebase.locationPath + locId).on('value', function (snap) {
                    recover.getResources(locId, function (data) {
                        web.broadcastResources(locId, data);
                    });
                })
            }
        }
    });

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

    var fillPosterInfo = function (data, callback) {
        var poster = data.poster;
        fb.ref(config.firebase.userPath + poster).once('value', function (snap) {
            var val = snap.val();
            data.posterName = val.firstName + ' ' + val.lastName;
            data.posterEmail = val.email;
            data.posterPhone = val.phoneNumber;

            fb.fileExists(config.firebase.userPath + poster, function (exists) {
                data.hasProfilePic = exists;
                callback(data);
            });
        })
    };

    var formatLocationData = function (data, callback) {
        var resp = {
            resources: {},
            recoveryAreas: {}
        };
        var keys = Object.keys(data.resources);
        var proms = [];
        for (var i = 0; i < keys.length; i++) {
            const id = keys[i];
            proms.push(new Promise(function (resolve, reject) {
                fb.ref(config.firebase.resourcePath + id).once('value', function (snap) {
                    fillPosterInfo(snap.val(), function (data) {
                        resp.resources[id] = data;
                        resolve();
                    });
                });
            }));
        }
        keys = Object.keys(data.recoveryAreas);
        for (var i = 0; i < keys.length; i++) {
            const id = keys[i];
            proms.push(new Promise(function (resolve, reject) {
                fb.ref(config.firebase.recoveryPath + id).once('value', function (snap) {
                    fillPosterInfo(snap.val(), function (data) {
                        resp.recoveryAreas[id] = data;
                        resolve();
                    });
                });
            }));
        }
        Promise.all(proms).then(function () {
            callback(resp);
        });
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
        },
        getResources: function (cityId, callback) {
            fb.ref(config.firebase.locationPath + cityId).once('value', function (snap) {
                var val = snap.val();
                if (!val) {
                    return callback({
                        resources: {},
                        recoveryAreas: {}
                    });
                }

                formatLocationData(val, callback);
            })
        },
        getCheckins: function (areaId, callback) {
            var checks = [];

            var resolve = function () {
                callback(checks);
            };

            fb.ref(config.firebase.locationCheckIn + areaId).once('value', function (snap) {
                var users = snap.val();
                if (!users) {
                    return resolve();
                }
                var userIds = Object.keys(users);

                var proms = [];
                for (var i = 0; i < userIds.length; i++) {
                    const userId = userIds[i];
                    proms.push(new Promise(function (resolve, reject) {
                        fb.ref(config.firebase.userPath + userId).once('value', function (snap) {
                            var user = snap.val();
                            checks.push({
                                email: user.email,
                                firstName: user.firstName,
                                lastName: user.lastName,
                                phoneNumber: user.phoneNumber
                            });
                            resolve();
                        });
                    }));
                }
                Promise.all(proms).then(resolve, resolve);
            });
        }
    };
})();

//Sample data generator
var test;
(function () {
    var getUsers = function (callback) {
        fb.ref(config.firebase.userPath).once('value', function (snap) {
            var users = snap.val();
            var userIds = Object.keys(users);
            callback(users, userIds);
        });
    };

    var puertoRicoLatLng = function () {
        var xmin = 18.036198;
        var xmax = 18.430108;
        var ymin = -67.147064;
        var ymax = -65.782571;

        var x = xmin + (xmax - xmin) * Math.random();
        var y = ymin + (ymax - ymin) * Math.random();

        return {
            latitude: x,
            longitude: y,
        };
    };

    var atlantaLatLng = function () {
        var xmin = -84.486923;
        var xmax = -84.258957;
        var ymin = 33.655781;
        var ymax = 33.904616;

        var x = xmin + (xmax - xmin) * Math.random();
        var y = ymin + (ymax - ymin) * Math.random();

        return {
            latitude: y,
            longitude: x,
        };
    };

    var randomLatLng = atlantaLatLng;

    test = {
        getUidFromEmail: function (email, callback) {
            getUsers(function (users, userIds) {
                for (var i = 0; i < userIds.length; i++) {
                    var userId = userIds[i];
                    if (users[userId].email == email) {
                        return callback(userId);
                    }
                }
            });
        },
        createUser: function (email, firstName, lastName, phoneNumber, callback) {
            var latlng = randomLatLng();
            fb.getUniqueKey(28, config.firebase.userPath, function (uid) {
                fb.ref(config.firebase.userPath + uid).update({
                    email: email,
                    firstName: firstName,
                    lastName: lastName,
                    phoneNumber: phoneNumber,
                    helpRequest: 0,
                    latitude: latlng.latitude,
                    longitude: latlng.longitude
                });
                callback(uid);
            });
        },
        createUsers: function (emailEnd, firstName, lastName, minI, maxI) {
            for (var i = minI; i < maxI; i++) {
                test.createUser('user' + i + '@' + emailEnd, firstName, lastName + i, '1234567890', function (uid) {
                    console.log(uid);
                });
            }
        },
        addRecoverAreas: function (emailEnd, num, cityId) {
            getUsers(function (users, userIds) {
                var cur = 0;
                while (cur < num) {
                    for (var i = 0; i < userIds.length && cur < num; i++) {
                        var userId = userIds[i];
                        var user = users[userId];
                        if (user.email.endsWith('@' + emailEnd)) {
                            recover.addRecoveryArea(userId, cityId, 'TITLE_' + lib.randomString(5), 'CONTENT_' + lib.randomString(5));
                            cur++;
                        }
                    }
                }
            });
        },
        addResources: function (emailEnd, num, cityId) {
            getUsers(function (users, userIds) {
                var cur = 0;
                while (cur < num) {
                    for (var i = 0; i < userIds.length && cur < num; i++) {
                        var userId = userIds[i];
                        var user = users[userId];
                        if (user.email.endsWith('@' + emailEnd)) {
                            recover.addResource(userId, cityId, 'TITLE_' + lib.randomString(5), 'CONTENT_' + lib.randomString(5), Math.floor(Math.random() * 5));
                            cur++;
                        }
                    }
                }
            });
        },
        updateRecoveryAreaLatLng: function (cityIdEnd) {
            fb.ref(config.firebase.recoveryPath).once('value', function (snap) {
                var val = snap.val();
                var keys = Object.keys(val);
                for (var i = 0; i < keys.length; i++) {
                    var area = val[keys[i]];
                    if (area.cityId.endsWith(cityIdEnd)) {
                        var latlng = randomLatLng();
                        fb.ref(config.firebase.recoveryPath + keys[i]).update(latlng);
                    }
                }
            })
        },
        updateResourceLatLng: function (cityIdEnd) {
            fb.ref(config.firebase.resourcePath).once('value', function (snap) {
                var val = snap.val();
                var keys = Object.keys(val);
                for (var i = 0; i < keys.length; i++) {
                    var area = val[keys[i]];
                    if (area.cityId.endsWith(cityIdEnd)) {
                        var latlng = randomLatLng();
                        fb.ref(config.firebase.resourcePath + keys[i]).update(latlng);
                    }
                }
            })
        },
        updateUserHelpRequest: function (emailEnd) {
            getUsers(function (users, userIds) {
                for (var i = 0; i < userIds.length; i++) {
                    var userId = userIds[i];
                    var user = users[userId];
                    if (user.email.endsWith('@' + emailEnd)) {
                        var latlng = randomLatLng();
                        recover.updateHelpRequest(userId, latlng.latitude, latlng.longitude);
                    }
                }
            });
        },
        updateResourceText: function () {
            var msgs = {
                0: ["I have %x% spots left in my house", "Come crash on my couch! Room for %x% people"],
                1: ["I have extra food if anyone needs it", "Lots of extra water, let me know if you need any"],
                2: ["I am a doctor and am willing to help anyone in need of medical assistance"],
                3: ["I have lots of extra clothing"],
                4: ["I can drive anyone anywhere if they need help!"]
            };
            var titles = {
                0: ["House space"],
                1: ["Extra food/water"],
                2: ["Medical help"],
                3: ["Free clothes"],
                4: ["Car rides available"]
            };

            fb.ref(config.firebase.resourcePath).once('value', function (snap) {
                var items = snap.val();
                var keys = Object.keys(items);
                for (var i = 0; i < keys.length; i++) {
                    var category = i % 5;
                    var mm = msgs[category];
                    var tt = titles[category];
                    var id = keys[i];
                    fb.ref(config.firebase.resourcePath + id).update({
                        category: category,
                        title: tt[Math.floor(Math.random() * tt.length)].replace(/%x%/g, (Math.floor(Math.random() * 7) + 2) + ''),
                        content: mm[Math.floor(Math.random() * mm.length)].replace(/%x%/g, (Math.floor(Math.random() * 7) + 2) + '')
                    });
                }
            })
        }
    };

})();

//Start web
web.start();