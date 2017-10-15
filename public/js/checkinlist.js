var $checkinlist = $('#checkinList');

var checks = serverData.checkins;
for (var i = 0; i < checks.length; i++) {
    var user = checks[i];
    var $div = $(document.createElement('div')).addClass('checkinobj');
    $div.html(user.firstName + ' ' + user.lastName);
    $checkinlist.append($div);
}