$('#firstName').val(serverData.firstName);
$('#lastName').val(serverData.lastName);
$('#phoneNumber').val(serverData.phoneNumber);

$('#changePassBtn').click(function () {
    var newPass = $('#newPassword').val();
    var newCPass = $('#newCPassword').val();
    if (newPass != newCPass) {
        return alert('Passwords do not match');
    }

    if (newPass.length < 6) {
        return alert('Password is too short');
    }

    $('#changePassForm').submit();
});