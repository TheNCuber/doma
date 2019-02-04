(function($) {
    $.fn.overviewMap = function(options)
    {
        $(this).each(function() {
            var mapElement = $(this);
            var mapBounds = new mapboxgl.LngLatBounds();
            var mapLoaded = false;
            var tooltip = false;
            var markers = [];
            var emptySource = {
                type: 'Feature',
                geometry: {
                    'type': 'Polygon',
                    'coordinates': [[[0,0],
                        [0,0],
                        [0,0],
                        [0,0],
                        [0,0]]]
                }
            };
            var markerSource = {
                'type': 'FeatureCollection',
                'features': []
            };
            var polygonSource = {
                'type': 'FeatureCollection',
                'features': []
            };
            var routeSource = {
                'type': 'FeatureCollection',
                'features': []
            };

            if (typeof options.data[0] === 'undefined' || options.data[0] === null) {
                var fillColor = '#ff0000';
                var fillOpacity = 0.3;
                var fillOutlineColor = '#ff0000';
                var lineColor = '#ff0000';
                var lineWidth = 3;
                var lineOpacity = 1;
            } else {
                var fillColor = options.data[0].FillColor;
                var fillOpacity = options.data[0].FillOpacity;
                var fillOutlineColor = options.data[0].BorderColor;
                var lineColor = options.data[0].RouteColor;
                var lineWidth = options.data[0].RouteWidth;
                var lineOpacity = options.data[0].RouteOpacity;
            }

            mapboxgl.accessToken = mapbox_APIKey;
            var map = new mapboxgl.Map({
                container: mapElement.get(0),                   // container id
                style: 'mapbox://styles/mapbox/outdoors-v11',   // stylesheet location
                center: [8.11, 47.17],                          // starting position [lng, lat]
                zoom: 12                                        // starting zoom
            });
            map.addControl(new mapboxgl.NavigationControl());
            var lastShownTooltipMapId = 0;
            var hoveredMapId = null;
            var lastZoom = -1;
            var zoomLimit = 10;

            // iterate over all maps
            for(var i in options.data)
            {
                var data = options.data[i];
                tooltip = (data.TooltipMarkup != null);
                // the map borders for large scale overview map
                var vertices =
                    [
                        new mapboxgl.LngLat(data.Corners[0].Longitude, data.Corners[0].Latitude),
                        new mapboxgl.LngLat(data.Corners[1].Longitude, data.Corners[1].Latitude),
                        new mapboxgl.LngLat(data.Corners[2].Longitude, data.Corners[2].Latitude),
                        new mapboxgl.LngLat(data.Corners[3].Longitude, data.Corners[3].Latitude),
                        new mapboxgl.LngLat(data.Corners[0].Longitude, data.Corners[0].Latitude)
                    ];

                // polygon
                var polygonFeature = {
                    'type': 'Feature',
                    'id': data.MapId,
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [[[data.Corners[0].Longitude, data.Corners[0].Latitude],
                            [data.Corners[1].Longitude, data.Corners[1].Latitude],
                            [data.Corners[2].Longitude, data.Corners[2].Latitude],
                            [data.Corners[3].Longitude, data.Corners[3].Latitude],
                            [data.Corners[0].Longitude, data.Corners[0].Latitude]]]
                    }
                };
                polygonSource.features.push(polygonFeature);

                // marker
                var markerFeature = {
                    'type': 'Feature',
                    'id': data.MapId,
                    'properties': {
                        'url': (tooltip ? data.Url.replace('&amp;', '&') : '')
                    },
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [data.MapCenter.Longitude, data.MapCenter.Latitude]
                    }
                };
                markerSource.features.push(markerFeature);

                // route lines (if data.RouteCoordinates is present)
                if(data.RouteCoordinates != null)
                {
                    for(var i in data.RouteCoordinates)
                    {
                        var points = new Array(data.RouteCoordinates[i].length);
                        for(var j in data.RouteCoordinates[i])
                        {
                            var vertex = data.RouteCoordinates[i][j];
                            points[j] = [vertex[0], vertex[1]];
                        }
                        var routeFeature = {
                            'type': 'Feature',
                            'id': data.MapId,
                            'geometry': {
                                'type': 'LineString',
                                'coordinates': points
                            }
                        };
                        routeSource.features.push(routeFeature);
                    }
                }

                // make sure all maps fits in overview map
                mapBounds.extend(vertices[0]);
                mapBounds.extend(vertices[1]);
                mapBounds.extend(vertices[2]);
                mapBounds.extend(vertices[3]);
            }

            map.on('load', function () {
                map.addSource('polygonSource', {
                    'type': 'geojson',
                    'data': polygonSource
                });
                map.addSource('routeSource', {
                    'type': 'geojson',
                    'data': routeSource
                });
                map.addSource('markerSource', {
                    'type': 'geojson',
                    'data': markerSource
                });

                map.addLayer({
                    'id': 'polygons',
                    'type': 'fill',
                    'source': 'polygonSource',
                    'layout': {},
                    'paint': {
                        'fill-color': fillColor,
                        'fill-outline-color': fillOutlineColor,
                        'fill-opacity': ["case", ["boolean", ["feature-state", "hover"], false], 0.6, fillOpacity]
                    }
                });
                map.addLayer({
                    'id': 'routes',
                    'type': 'line',
                    'source': 'routeSource',
                    'layout': {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    'paint': {
                        'line-color': lineColor,
                        'line-width': lineWidth,
                        'line-opacity': lineOpacity
                    }
                });
                markerSource.features.forEach(function(entry) {
                    // create a DOM element for the marker
                    var el = document.createElement('div');
                    el.className = 'marker';
                    el.style.backgroundImage = 'url(gfx/control_flag.png)';
                    el.style.width = 16 + 'px';
                    el.style.height = 16 + 'px';

                    if(tooltip) {
                        el.style.cursor = 'pointer';
                        el.addEventListener('click', function () {
                            window.location = entry.properties.url;
                        });
                        el.addEventListener('mouseenter',function () {
                            el.style.backgroundImage = 'url(gfx/control_flag_highlighted.png)';
                            showTooltip(options.data.find(function(i) {
                                return (i.MapId == entry.id);
                            }));
                        });
                        el.addEventListener('mouseleave', function() {
                            el.style.backgroundImage = 'url(gfx/control_flag.png)';
                            if(lastShownTooltipMapId !== 0)
                            {
                                Tooltip.hide();
                                lastShownTooltipMapId = 0;
                            }
                        });
                    }

                    var currentMarker = new mapboxgl.Marker(el)
                        .setLngLat(entry.geometry.coordinates);
                    markers.push(currentMarker);
                });
                if (map.getZoom() < zoomLimit && (lastZoom >= zoomLimit || lastZoom === -1)) {
                    markers.forEach(function(marker) {
                        marker.addTo(map);
                    });
                }

                mapLoaded = true;
            });

            map.fitBounds(mapBounds);

            map.on('zoomend', function () {
                if(mapLoaded) {
                    var zoom = map.getZoom();
                    if (zoom < zoomLimit && (lastZoom >= zoomLimit || lastZoom === -1)) {
                        map.getSource('polygonSource').setData(emptySource);
                        map.getSource('routeSource').setData(emptySource);
                        map.getSource('markerSource').setData(markerSource);
                        markers.forEach(function(marker) {
                            marker.addTo(map);
                        });
                    }
                    if (zoom >= zoomLimit && (lastZoom < zoomLimit || lastZoom === -1)) {
                        map.getSource('polygonSource').setData(polygonSource);
                        map.getSource('routeSource').setData(routeSource);
                        map.getSource('markerSource').setData(emptySource);
                        markers.forEach(function(marker) {
                            marker.remove();
                        });
                    }
                    lastZoom = zoom;
                }
            } );

            if (tooltip) {
                map.on('mousemove', 'polygons', function (e) {
                    if (e.features.length > 0) {
                        if (hoveredMapId) {
                            map.setFeatureState({source: 'polygonSource', id: hoveredMapId}, {hover: false});
                        }
                        hoveredMapId = e.features[0].id;
                        map.setFeatureState({source: 'polygonSource', id: hoveredMapId}, {hover: true});
                        showTooltip(options.data.find(function(i) {
                            return (i.MapId == hoveredMapId);
                        }));
                    }
                });
                map.on('mouseleave', 'polygons', function () {
                    if (hoveredMapId) {
                        map.setFeatureState({source: 'polygonSource', id: hoveredMapId}, { hover: false});
                    }
                    hoveredMapId =  null;
                    if(lastShownTooltipMapId !== 0)
                    {
                        Tooltip.hide();
                        lastShownTooltipMapId = 0;
                    }
                });
                map.on('click','polygons',function(e) {
                    var clickedPolygons = map.queryRenderedFeatures(e.point).filter(feature => feature.layer.id === 'polygons');
                    if(clickedPolygons.length) {
                        window.location = markerSource.features.find(function(marker) {
                            return (marker.id == clickedPolygons[0].id);
                        }).properties.url;
                    }
                });
                function showTooltip(e)
                {
                    if(e.MapId !== lastShownTooltipMapId)
                    {
                        Tooltip.show(e.TooltipMarkup);
                        lastShownTooltipMapId = e.MapId;
                    }
                }
            }
        });
    };
})(jQuery);

var Tooltip=function(){
    var id = 'tt';
    var top = 12;
    var left = 12;
    var maxw = 600;
    var speed = 15;
    var timer = 20;
    var endalpha = 85;
    var alpha = 0;
    var tt,h;
    var ie = document.all ? true : false;
    return{
        show:function(v,w){
            if(tt == null){
                tt = document.createElement('div');
                tt.setAttribute('id',id);
                document.body.appendChild(tt);
                tt.style.opacity = 0;
                tt.style.filter = 'alpha(opacity=0)';
                document.onmousemove = this.pos;
            }
            tt.style.display = 'block';
            tt.innerHTML = v;
            tt.style.width = w ? w + 'px' : 'auto';
            if(!w && ie){
                tt.style.width = tt.offsetWidth;
            }
            if(tt.offsetWidth > maxw){tt.style.width = maxw + 'px'}
            h = parseInt(tt.offsetHeight) + top;
            clearInterval(tt.timer);
            tt.timer = setInterval(function(){Tooltip.fade(1)},timer);
        },
        pos:function(e){
            var u = ie ? event.clientY + document.documentElement.scrollTop : e.pageY;
            var l = ie ? event.clientX + document.documentElement.scrollLeft : e.pageX;
            tt.style.top = (u - h) + 'px';
            tt.style.left = (l + left) + 'px';
        },
        fade:function(d){
            var a = alpha;
            if((a != endalpha && d == 1) || (a != 0 && d == -1)){
                var i = speed;
                if(endalpha - a < speed && d == 1){
                    i = endalpha - a;
                }else if(alpha < speed && d == -1){
                    i = a;
                }
                alpha = a + (i * d);
                tt.style.opacity = alpha * .01;
                tt.style.filter = 'alpha(opacity=' + alpha + ')';
            }else{
                clearInterval(tt.timer);
                if(d == -1){tt.style.display = 'none'}
            }
        },
        hide:function(){
            if(tt != null)
            {
                clearInterval(tt.timer);
                tt.timer = setInterval(function(){Tooltip.fade(-1)},timer);
            }
        }
    };
}();