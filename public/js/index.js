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
var labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var labelIndex = 0;



function initMap() {
    
    var center = new google.maps.LatLng(37.774546, -100.433523);
    var wineCountry = new google.maps.LatLng(33.51536,   -117.103348);
    var houston = new google.maps.LatLng(29.7604,   -95.3698);
    var puertorico = new google.maps.LatLng(18.2208,   -66.5901);
    var miami = new google.maps.LatLng(25.7617,   -80.1918);

    map = new google.maps.Map(document.getElementById('map'), {
        center: center,
        zoom: 4,
        mapTypeId: 'satellite'
    });
    
    var infowindow = new google.maps.InfoWindow({
                                                content: "RedCross Relief Tent"
                                                });
    
    var marker = new google.maps.Marker({
                                        position: wineCountry,
                                        map: map,
                                        title: 'Relief Tent'
                                        });
    marker.addListener('click', function() {
                       infowindow.open(map, marker);
                       });
     

    var infowindow2 = new google.maps.InfoWindow({
                                                content: "National Guard Relief Tent"
                                                });
    
   var marker2 = new google.maps.Marker({
                                        position: houston,
                                        map: map,
                                        title: 'Relief Tent'
                                        });
    marker2.addListener('click', function() {
                       infowindow2.open(map, marker2);
                       });
    

    
    
    
    
    heatmap = new google.maps.visualization.HeatmapLayer({
        data: []
    });
    heatmap.setMap(map);
}
