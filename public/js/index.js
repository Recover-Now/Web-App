var socket = io();

socket.on('heatmapData', function (array) {
    console.log(array);
    var hmdata = [];
    for (var i = 0; i < array.length; i++) {
        hmdata.push(new google.maps.LatLng(array[i].latitude, array[i].longitude));
    }

    var newdata = new google.maps.MVCArray(hmdata);
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
