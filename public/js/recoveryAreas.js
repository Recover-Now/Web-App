//JQuery
var $resourceswrap = $('#resourceswrap');

var socket = io();

socket.emit('dashboard', true);

var pics = {
    0: 'pics/Housing.png',
    1: 'pics/foodwater.png',
    2: 'pics/Medical.png',
    3: 'pics/Clothing.png',
    4: 'pics/Rides.png'
};

socket.on('resources', function (data) {
    $resourceswrap.html('');

    var group = data.recoveryAreas;

    var keys = Object.keys(group);
    keys.sort(function (a, b) {
        var i1 = group[a];
        var i2 = group[b];
        return i1.title.localeCompare(i2.title);
    });

    for (var i = 0; i < keys.length; i++) {
        const id = keys[i];
        var item = group[id];
        var $div = $(document.createElement('div')).addClass('resourceobj');
        $div.append('<div class="pic"><img src="' + pics[item.category] + '"/></div>');
        $div.append('<div class="checkin"><input type="button" value="See Check-in List"/></div>');
        $div.find('.checkin').find('input').click(function () {
            window.location.href = 'checkinList.html?recoveryArea=' + id;
        });
        var $text = $(document.createElement('div')).addClass('text');
        $text.append('<div class="title">' + item.title + '</div>');
        $text.append('<div class="content">' + item.content + '</div>');
        $text.append('<div class="poster">' + item.posterName + '<br>' + item.posterPhone + '</div>');
        $text.append('<div class="posterimg"><img src="/profilepic?email=' + item.posterEmail + '"/></div>');
        if (!item.hasProfilePic) {
            //$text.find('.posterimg').css('visibility', 'hidden');
        }
        $div.append($text);
        $resourceswrap.append($div);
    }

    $('.resourceobj').each(function () {
        $(this).css('height', $(this).find('.text').height());
    });
});

