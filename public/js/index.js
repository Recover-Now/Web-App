var socket = io();

var hmMap = {};

socket.on('heatmapData', function (map) {
    console.log(map);
    var uids = Object.keys(map);
    for (var i = 0; i < uids.length; i++) {
        var uid = uids[i];
        hmMap[uid] = map[uid];
    }

    uids = Object.keys(hmMap);

    var hmdata = [];
    for (var i = 0; i < uids.length; i++) {
        var uid = uids[i];
        hmdata.push(new google.maps.LatLng(hmMap[uid].latitude, hmMap[uid].longitude));
    }

    var newdata = new google.maps.MVCArray(hmdata);
    console.log(hmdata);
    heatmap.set('data', newdata);
});

var heatmap;

function initMap() {
    var sanFrancisco = new google.maps.LatLng(37.774546, -100.433523);

    map = new google.maps.Map(document.getElementById('map'), {
        center: sanFrancisco,
        zoom: 4,
        mapTypeId: 'satellite'
    });

    heatmap = new google.maps.visualization.HeatmapLayer({
        data: []
    });
    heatmap.setMap(map);
}
