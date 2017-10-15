var $checkinlist = $('#checkinList');

var checks = serverData.checkins;
for (var i = 0; i < checks.length; i++) {
    var user = checks[i];
    var $div = $(document.createElement('div')).addClass('checkinobj');
    $div.append('<div class="imgwrap"><img src="/profilepic?email=' + user.email + '"/></div>');
    $div.append(user.firstName + ' ' + user.lastName);
    $checkinlist.append($div);
}
if (checks.length == 0) {
    $checkinlist.html('No one has checked into this recovery area');
}