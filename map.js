window.state = {
    imgLayer: null,
    bounds: null,
    features: {},
    featureCount: 0
};

var FeatureTypes = {
    POLYGON: "polygon",
    MARKER: "marker"
};

class MapFeature {
    static create(featureType, layer) {
        var feature = new MapFeature();
        feature.type = featureType;
        feature.name = layer.feature.properties.name;
        feature.id = window.state.featureCount = window.state.featureCount + 1
        feature.layer = layer;

        layer.feature.info = feature;
        window.state[`selected${featureType}`] = feature;
        window.state.features[featureType].push(feature);
        MapFeature.updateLists(featureType);
    }

    select() {
        this.selected = !this.selected;
        MapFeature.updateLists(this.type);
    }

    remove() {
        var i = window.state.features[this.type].map(a => a.id).indexOf(this.id);
        if (i > -1) {
            this.layer.remove();
            window.state.features[this.type].splice(i, 1);
            MapFeature.updateLists(this.type);
            
        }
    }

    modify(name) {
        if (name !== this.name) {
            this.name = name;
            MapFeature.updateLists(this.type);
        }
    }

    toGeoJSON() {
        var old_info = this.layer.feature.info;
        var id = this.id;
        delete this.layer.feature.info; // Removes circular dependency
        delete this.id;
        var geoJSON = this.layer.toGeoJSON();
        this.layer.info = old_info;
        this.id = id;
        return geoJSON;
    }

    static updateLists(featureType) {
        var list = $(`#${featureType}List`);
        list.empty();
        window.state.features[featureType].forEach((a, i) => {
            var inputGroupElem = document.createElement("div");
            var labelId = document.createElement("label");
            var labelName = document.createElement("label");
            var deleteBtn = document.createElement("div");

            inputGroupElem.classList.add("input-group", "p-0", "m-2");
            labelId.classList.add("input-group-text", "input-group-prepend");
            labelName.classList.add("btn", "btn-light", "input-group-text", "form-control");
            deleteBtn.classList.add("btn", "btn-danger", "input-group-append");

            labelId.style.background = "lightblue";
            labelId.textContent = i + 1;

            labelName.onclick = () => a.select();
            labelName.textContent = a.name;

            deleteBtn.onclick = () => a.remove();
            deleteBtn.textContent = "X";

            inputGroupElem.appendChild(labelId);
            inputGroupElem.appendChild(labelName);
            inputGroupElem.appendChild(deleteBtn);

            list.append(inputGroupElem);
        });
    }
}

var loadMapImg = function (img, bounds) {
    /*
        The X and Y bounds are swapped in leaflet. Use [height, width] for defining the map.
        See "This is not the LatLng you’re looking for" at https://leafletjs.com/examples/crs-simple/crs-simple.html
    */
    if (bounds != null) {
        window.state.bounds = bounds;
    } else if (window.state.bounds != null) {
        bounds = window.state.bounds;
    } else {
        bounds = [[0, 0], [img.height, img.width]];
        window.state.bounds = bounds;
    }
    
    if (window.state.imgLayer) {
        window.mapItem.removeLayer(window.state.imgLayer);
    }
    window.state.imgLayer = L.imageOverlay(img, bounds);
    window.state.imgLayer.addTo(window.mapItem);
    window.mapItem.fitBounds(bounds);

    var center = window.mapItem.getCenter();
    window.mapItem.options.crs = L.CRS[$('#coordSetting').val()];
    window.mapItem.setView(center);
    window.mapItem._resetView(window.mapItem.getCenter(), window.mapItem.getZoom());

    window.mapItem.addLayer(window.drawnItems);

    var options = {
        position: 'topright',
        draw: {
            polyline: false,
            polygon: {
                allowIntersection: true,
                shapeOptions: {
                    color: '#bada55'
                }
            },
            circle: false,
            rectangle: false,
            marker: {
            },
            circlemarker: false
        },
        edit: {
            featureGroup: window.drawnItems,
            remove: true
        }
    };

    var drawControl = new L.Control.Draw(options);
    window.mapItem.addControl(drawControl);
};

var loadGeoJson = () => {
    var json = JSON.parse($('#geojsondata').val());
    var featureList = null;
    if (Array.isArray(json)) {
        featureList = json;
    } else {
        featureList = json.features;
    }
    featureList.forEach(f => {
        f.type = f.type || "Feature";
        var geoJsonLayer = L.GeoJSON.geometryToLayer(f);
        var feature = geoJsonLayer.feature = geoJsonLayer.feature || {};
        var props = feature.properties = f.properties || {};
        props.type = props.type || f.geometry.type.toLowerCase();
        props.type = props.type === "point" ? "marker" : props.type;
        if (props.type === "polygon") {
            geoJsonLayer.options = { "stroke": true, "color": "#bada55", "weight": 4, "opacity": 0.5, "fill": true, "fillColor": null, "fillOpacity": 0.2, "clickable": true };
        }
        window.drawnItems.addLayer(geoJsonLayer);
    });
}

var copyGeoJson = (e) => {
    var features = Object.entries(window.state.features).map(([_, feature_group]) => feature_group).flat(1);
    e.attributes["data-clipboard-text"].value = "[" + features.map(p => JSON.stringify(p.toGeoJSON())).join(',') + "]";
};