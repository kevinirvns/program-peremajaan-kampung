function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    dropdown.classList.toggle('hidden');
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('hidden');
}

var maps = {};
var currentLayers = {
    adminBoundaries: null,
    kecamatanBoundaries: null,
    batasKelurahan: null,
    jalan: null,
    sungai: null,
    rumah: L.layerGroup(),
    konsolidasi: null
};

let originalRumahFeatures = [];

function initializeMap() {
    var map = L.map('map1', {
        maxZoom: 20
    }).setView([-7.780504871280521, 110.37054376704222], 17);
    maps['map1'] = map;

    var baseLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '© Google',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        maxZoom: 24
    }).addTo(map);

    var baseMaps = {
        "Google Satellite": baseLayer,
        "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 30
        }),
        "Carto Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© Carto',
            maxZoom: 30
        }),
        "Google Hybrid": L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            attribution: '© Google',
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            maxZoom: 30
        }),
        "Esri World Imagery": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri',
            maxZoom: 20
        })
    };

    const geojsonList = [
        { url: 'data/Batas_Kota.geojson', style: { color: "#FF4400", weight: 2, dashArray: 3, fillOpacity: 0.05 }, key: 'kota' },
        { url: 'data/Batas_Kecamatan.geojson', style: { color: "orange", weight: 2, fillOpacity: 0.05 }, key: 'kecamatan' },
        { url: 'data/Batas_Kelurahan.geojson', style: { color: "#00BFFF", weight: 2, fillOpacity: 0.05 }, key: 'kelurahan' },
        { url: 'data/Jalan.geojson', style: { color: "#f7fabf", weight: 5 }, key: 'jalan' },
        { url: 'data/Sungai.geojson', style: { color: "#aad3df", weight: 4 }, key: 'sungai' }
    ];

    geojsonList.forEach(layer => {
        fetch(layer.url)
            .then(res => res.json())
            .then(data => {
                let styledLayer;
                if (layer.key === 'jalan') {
                // Tambahkan dua layer: outline dan garis utama
                    const outlineLayer = L.geoJSON(data, {
                        style: () => ({ color: "#000000ff", weight: 7 }) // Outline putih, lebih tebal
                    });

                    const mainLayer = L.geoJSON(data, {
                        style: () => layer.style // Warna utama dari layer.style
                    });

                    styledLayer = L.layerGroup([outlineLayer, mainLayer]);
                } else {
                    styledLayer = L.geoJSON(data, { style: () => layer.style });
                }

                currentLayers[layer.key] = styledLayer;
        })
            .catch(err => console.error("Gagal memuat GeoJSON:", err));
    });

    fetch('data/Rumah.geojson')
        .then(response => response.json())
        .then(data => {
            originalRumahFeatures = data.features;
            applyRumahFilter();
        });

    fetch('data/KonsolidasiRW05.geojson')
        .then(response => response.json())
        .then(data => {
            const layer = L.geoJSON(data, {
                style: { color: 'purple', weight: 2, fillOpacity: 0.3 },
                onEachFeature: onEachFeature
            });
            currentLayers['konsolidasi'] = layer;
        });

    L.Control.geocoder({ position: 'topleft' }).addTo(map);

    document.querySelectorAll('input[name="legend"]').forEach(checkbox => {
        checkbox.checked = false;
        checkbox.addEventListener('change', function (e) {
            const v = e.target.value;
            const layer = currentLayers[v];
            if (layer) {
                if (e.target.checked) {
                    layer.addTo(map);
                } else {
                    map.removeLayer(layer);
                }
            }
        });
    });

    document.querySelectorAll('input[name="filter-status"], input[name="filter-dampak"]').forEach(cb => {
        cb.addEventListener('change', applyRumahFilter);
    });

    document.querySelectorAll('input[name="basemap"]').forEach(radio => {
        radio.addEventListener('change', function (e) {
            const selected = e.target.value;
            if (baseMaps[selected]) {
                Object.values(baseMaps).forEach(layer => {
                    if (map.hasLayer(layer)) {
                        map.removeLayer(layer);
                    }
                });
                baseMaps[selected].addTo(map);

                setTimeout(() => {
                    document.querySelectorAll('input[name="legend"]').forEach(checkbox => {
                        const layer = currentLayers[checkbox.value];
                        if (checkbox.checked && layer && !map.hasLayer(layer)) {
                            layer.addTo(map);
                        }
                    });
                }, 100);
            }
        });
    });

    map.on('mousemove', function (e) {
        document.getElementById('coordinates').innerHTML = `Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`;
    });
}

function onEachFeature(feature, layer) {
    const { RW, Nomor, Nama, Status, Terdampak } = feature.properties;
    var popupContent = `
        <table>
            <tr><td><strong>RW</strong></td><td>${RW ?? "-"}</td></tr>
            <tr><td><strong>Nomor</strong></td><td>${Nomor ?? "-"}</td></tr>
            <tr><td><strong>Nama</strong></td><td>${Nama ?? "-"}</td></tr>
            <tr><td><strong>Status</strong></td><td>${Status ?? "-"}</td></tr>
            <tr><td><strong>Terdampak</strong></td><td>${Terdampak ?? "-"}</td></tr>
        </table>`;
    layer.bindPopup(popupContent);
}

function applyRumahFilter() {
    const map = maps['map1'];
    const rumahLayer = currentLayers['rumah'];
    rumahLayer.clearLayers();

    const statusFilters = Array.from(document.querySelectorAll('input[name="filter-status"]:checked')).map(cb => cb.value.toLowerCase());
    const dampakFilters = Array.from(document.querySelectorAll('input[name="filter-dampak"]:checked')).map(cb => cb.value.toLowerCase());

    originalRumahFeatures.forEach(feature => {
        const props = feature.properties;
        const status = (props.Status || '').toLowerCase();
        const dampak = (props.Terdampak || '').toLowerCase();

        const matchStatus = statusFilters.length === 0 || statusFilters.includes(status);
        const matchDampak = dampakFilters.length === 0 || dampakFilters.includes(dampak);

        if (matchStatus && matchDampak) {
            const rumahSubLayer = L.geoJSON(feature, {
                style: { color: 'red', weight: 2, fillOpacity: 0.3 },
                onEachFeature: onEachFeature
            });
            rumahLayer.addLayer(rumahSubLayer);
        }
    });

    if (document.querySelector('#rumah').checked && !map.hasLayer(rumahLayer)) {
        rumahLayer.addTo(map);
    }
}

function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            const userIcon = L.icon({
                iconUrl: 'img/icon/placeholder.png',
                iconSize: [38, 38],
                iconAnchor: [19, 38],
                popupAnchor: [1, -34]
            });
            const userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(maps['map1']);
            userMarker.bindPopup(`Lokasi Anda sekarang di sini<br>Akurasi: ${accuracy.toFixed(2)} meters`).openPopup();
            userMarker.on('click', () => userMarker.openPopup());
            maps['map1'].setView([lat, lng], 19);
        }, error => console.error("Geolocation error: " + error.message));
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

initializeMap();
