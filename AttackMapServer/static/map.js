// To access by a browser in another computer, use the external IP of machine running AttackMapServer
// from the same computer(only), you can use the internal IP.
// Example:
// - AttackMapServer machine:
//   - Internal IP: 127.0.0.1
//   - External IP: 192.168.11.106
var webSock = new WebSocket("wss:/127.0.0.1/websocket"); // Internal
//var webSock = new WebSocket("ws:/192.168.1.100:8888/websocket"); // External

// link map

L.mapbox.accessToken = "pk.eyJ1IjoiYW1lc2Vyb2xlIiwiYSI6ImNqNzg3bjlnajFsc20zM254N2lyZnNybTMifQ.WEdY-TbhBIwgcCQKck_MFw";
var map = L.mapbox.map("map", "mapbox.dark", {
center: [0, 0], // lat, long
zoom: 2
});

// add full screen option
L.control.fullscreen().addTo(map);

// hq coords
var hqLatLng = new L.LatLng(37.3845, -122.0881);

// hq marker
L.circle(hqLatLng, 110000, {
color: 'red',
fillColor: 'yellow',
fillOpacity: 0.5,
}).addTo(map);

// Append <svg> to map
var svg = d3.select(map.getPanes().overlayPane).append("svg")
.attr("class", "leaflet-zoom-animated")
.attr("width", window.innerWidth)
.attr("height", window.innerHeight);

// Append <g> to svg
//var g = svg.append("g").attr("class", "leaflet-zoom-hide");

function translateSVG() {
    var viewBoxLeft = document.querySelector("svg.leaflet-zoom-animated").viewBox.animVal.x;
    var viewBoxTop = document.querySelector("svg.leaflet-zoom-animated").viewBox.animVal.y;

    // Resizing width and height in case of window resize
    svg.attr("width", window.innerWidth);
    svg.attr("height", window.innerHeight);

    // Adding the ViewBox attribute to our SVG to contain it
    svg.attr("viewBox", function () {
        return "" + viewBoxLeft + " " + viewBoxTop + " "  + window.innerWidth + " " + window.innerHeight;
    });

    // Adding the style attribute to our SVG to translate it
    svg.attr("style", function () {
        return "transform: translate3d(" + viewBoxLeft + "px, " + viewBoxTop + "px, 0px);";
    });
}

function update() {
    translateSVG();
    // additional stuff
}

// Re-draw on reset, this keeps the markers where they should be on reset/zoom
map.on("moveend", update);

function calcMidpoint(x1, y1, x2, y2, bend) {
    if(y2<y1 && x2<x1) {
        var tmpy = y2;
        var tmpx = x2;
        x2 = x1;
        y2 = y1;
        x1 = tmpx;
        y1 = tmpy;
    }
    else if(y2<y1) {
        y1 = y2 + (y2=y1, 0);
    }
    else if(x2<x1) {
        x1 = x2 + (x2=x1, 0);
    }

    var radian = Math.atan(-((y2-y1)/(x2-x1)));
    var r = Math.sqrt(x2-x1) + Math.sqrt(y2-y1);
    var m1 = (x1+x2)/2;
    var m2 = (y1+y2)/2;

    var min = 2.5, max = 7.5;
    //var min = 1, max = 7;
    var arcIntensity = parseFloat((Math.random() * (max - min) + min).toFixed(2));

    if (bend === true) {
        var a = Math.floor(m1 - r * arcIntensity * Math.sin(radian));
        var b = Math.floor(m2 - r * arcIntensity * Math.cos(radian));
    } else {
        var a = Math.floor(m1 + r * arcIntensity * Math.sin(radian));
        var b = Math.floor(m2 + r * arcIntensity * Math.cos(radian));
    }

    return {"x":a, "y":b};
}

function translateAlong(path) {
    var l = path.getTotalLength();
    return function(i) {
        return function(t) {
            // Put in try/catch because sometimes floating point is stupid..
            try {
            var p = path.getPointAtLength(t*l);
            return "translate(" + p.x + "," + p.y + ")";
            } catch(err){
            console.log("Caught exception.");
            return "ERROR";
            }
        }
    }
}

function handleParticle(msg, srcPoint) {
    var i = 0;
    var x = srcPoint['x'];
    var y = srcPoint['y'];

    svg.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 1e-6)
        .style('fill', 'none')
        //.style('stroke', d3.hsl((i = (i + 1) % 360), 1, .5))
        .style('stroke', msg.color)
        .style('stroke-opacity', 1)
        .transition()
        .duration(2000)
        .ease(Math.sqrt)
        .attr('r', 35)
        .style('stroke-opacity', 1e-6)
        .remove();

    //d3.event.preventDefault();
}

function handleTraffic(msg, srcPoint, hqPoint) {
    var fromX = srcPoint['x'];
    var fromY = srcPoint['y'];
    var toX = hqPoint['x'];
    var toY = hqPoint['y'];
    var bendArray = [true, false];
    var bend = bendArray[Math.floor(Math.random() * bendArray.length)];

    var lineData = [srcPoint, calcMidpoint(fromX, fromY, toX, toY, bend), hqPoint]
    var lineFunction = d3.svg.line()
        .interpolate("basis")
        .x(function(d) {return d.x;})
        .y(function(d) {return d.y;});

    var lineGraph = svg.append('path')
            .attr('d', lineFunction(lineData))
            .attr('opacity', 0.8)
            .attr('stroke', msg.color)
            .attr('stroke-width', 2)
            .attr('fill', 'none');

    if (translateAlong(lineGraph.node()) === 'ERROR') {
        console.log('translateAlong ERROR')
        return;
    }

    var circleRadius = 6

    // Circle follows the line
    var dot = svg.append('circle')
        .attr('r', circleRadius)
        .attr('fill', msg.color)
        .transition()
        .duration(700)
        .ease('ease-in')
        .attrTween('transform', translateAlong(lineGraph.node()))
        .each('end', function() {
            d3.select(this)
                .transition()
                .duration(500)
                .attr('r', circleRadius * 2.5)
                .style('opacity', 0)
                .remove();
    });

    var length = lineGraph.node().getTotalLength();
    lineGraph.attr('stroke-dasharray', length + ' ' + length)
        .attr('stroke-dashoffset', length)
        .transition()
        .duration(700)
        .ease('ease-in')
        .attr('stroke-dashoffset', 0)
        .each('end', function() {
            d3.select(this)
                .transition()
                .duration(100)
                .style('opacity', 0)
                .remove();
    });
}

var circles = new L.LayerGroup();
map.addLayer(circles);

function addCircle(msg, srcLatLng) {
    circleCount = circles.getLayers().length;
    circleArray = circles.getLayers();

    // Only allow 50 circles to be on the map at a time
    if (circleCount >= 50) {
        circles.removeLayer(circleArray[0]);
    }

    L.circle(srcLatLng, 50000, {
        color: msg.color,
        fillColor: msg.color,
        fillOpacity: 0.2,
        }).addTo(circles);
    }

// WEBSOCKET STUFF

webSock.onmessage = function (e) {
    console.log("Got a websocket message...");
    try {
        var msg = JSON.parse(e.data);
        console.log(msg);
        switch(msg.type) {
        case "Traffic":
            console.log("Traffic!");
            var srcLatLng = new L.LatLng(msg.src_lat, msg.src_long);
            var hqPoint = map.latLngToLayerPoint(hqLatLng);
            var srcPoint = map.latLngToLayerPoint(srcLatLng);
            console.log('');
            addCircle(msg, srcLatLng);
            handleParticle(msg, srcPoint);
            handleTraffic(msg, srcPoint, hqPoint, srcLatLng);
            break;
        // Add support for other message types?
        }
    } catch(err) {
        console.log(err)
    }
};

