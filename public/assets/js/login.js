$('input[type="submit"]').mousedown(function(){
    $(this).css('background', '#2ecc71');
});
$('input[type="submit"]').mouseup(function(){
    $(this).css('background', '#1abc9c');
});

$('#loginform').click(function(){
    $('.modemode').css('display', 'none');
    $('.modelogin').css('display', 'block');
    $('.login').fadeToggle('slow');
    $(this).toggleClass('green');
    var rect = $('#loginform')[0].getBoundingClientRect();
    var loginRect = $('.login')[0].getBoundingClientRect();
    $('#navthing').find('.arrow-up').css('left', (rect.left - loginRect.left + 12) + 'px');
});

$('#registerform').click(function(){
    $('.modemode').css('display', 'none');
    $('.moderegister').css('display', 'block');
    $('.login').fadeToggle('slow');
    $(this).toggleClass('green');
    var rect = $('#registerform')[0].getBoundingClientRect();
    var loginRect = $('.login')[0].getBoundingClientRect();
    $('#navthing').find('.arrow-up').css('left', (rect.left - loginRect.left + 25) + 'px');
});

var $register = $('#regform');
$register.find('.btn').click(function () {
    var pass = $register.find('.pass').val();
    var cpass = $register.find('.cpass').val();
    if (pass != cpass) {
        return alert('Boi u wrong aboot what? YOUR PASSSS IS NOT MATCH');
    }
    $register.submit();
});

$(document).mouseup(function (e)
{
    var container = $(".login");

    if (!container.is(e.target) // if the target of the click isn't the container...
        && container.has(e.target).length === 0) // ... nor a descendant of the container
    {
        container.hide();
        $('#loginform').removeClass('green');
    }
});