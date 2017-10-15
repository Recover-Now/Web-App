var lib = {};

lib.randomString = function (len) {
    var alpha = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    var str = '';
    for (var i = 0; i < len; i++) {
        str += alpha.charAt(Math.floor(Math.random() * alpha.length));
    }
    return str;
};

lib.now = function () {
    return new Date().getTime();
};

module.exports = {
    lib: lib
};