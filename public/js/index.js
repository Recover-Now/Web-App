var socket = io();

var hmMap = {};

socket.on('heatmapData', function (map) {
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
    heatmap.set('data', newdata);
});

socket.on('recoveryAreas', function (array) {
    console.log('recov',array);
    for (var i = 0; i < array.length; i++) {
        var area = array[i];

        const infowindow = new google.maps.InfoWindow({
            content: area.title + '<br>' + area.content
        });

        const marker = new google.maps.Marker({
            position: new google.maps.LatLng(area.latitude, area.longitude),
            map: map,
            title: 'Uluru (Ayers Rock)'
        });

        marker.addListener('click', function () {
            infowindow.open(map, marker);
        });
    }
});

var map, heatmap;

function initMap() {
    //Setup map
    var sanFrancisco = new google.maps.LatLng(37.774546, -120.433523);
    map = new google.maps.Map(document.getElementById('map'), {
        center: sanFrancisco,
        zoom: 4,
        mapTypeId: 'satellite'
    });

    //Setup heatmap
    heatmap = new google.maps.visualization.HeatmapLayer({
        data: []
    });
    heatmap.setMap(map);
}