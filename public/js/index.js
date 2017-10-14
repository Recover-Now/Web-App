var socket = io();

socket.on('heatmapData', function (array) {
    console.log(array);
          var hmdata = [];
          for(var i = 0; i < array.length; i++)
          {
          hmdata.push( new google.maps.LatLng(array.latitude, array.longitude));
          }
          heatmap = new google.maps.visualization.HeatmapLayer({                                                                data: hmData
       });
          heatmap.setMap(map);
});

var heatmap;

function initMap() {
    var sanFrancisco = new google.maps.LatLng(37.774546, -100.433523);

    map = new google.maps.Map(document.getElementById('map'), {
        center: sanFrancisco,
        zoom: 4,
        mapTypeId: 'satellite'
    });

   
 //   heatmap.setMap(map);
}
