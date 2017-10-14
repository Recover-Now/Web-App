$('input[type="submit"]').mousedown(function(){
    $(this).css('background', '#2ecc71');
});
$('input[type="submit"]').mouseup(function(){
    $(this).css('background', '#1abc9c');
});

$('#loginform').click(function(){
    $('.login').fadeToggle('slow');
    $(this).toggleClass('green');
    var rect = $('#loginform')[0].getBoundingClientRect();
    var loginRect = $('.login')[0].getBoundingClientRect();
    $('#navthing').find('.arrow-up').css('left', (rect.left - loginRect.left + 12) + 'px');
});

$('#registerform').click(function(){
    $('.login').fadeToggle('slow');
    $(this).toggleClass('green');
    var rect = $('#registerform')[0].getBoundingClientRect();
    var loginRect = $('.login')[0].getBoundingClientRect();
    $('#navthing').find('.arrow-up').css('left', (rect.left - loginRect.left + 25) + 'px');
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