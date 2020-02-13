<template>
    <div class='h-full'>
        <div id='map' class='w-full h-full'></div>

        <div class='absolute z5 w180 bg-white round px12 py12' style='bottom: 40px; left: 12px;'>
            <template v-if='inspect'>
                <div class='flex-parent flex-parent--center-main'>
                    <div class='flex-child'>
                        <svg class='icon w30 h30'><use xlink:href='#icon-info'/></svg>
                    </div>
                </div>
                <div class='flex-parent flex-parent--center-main'>
                    <div class='flex-child'>
                        <span v-text='this.layer'></span>: <span v-text='(this.inspect * 100).toFixed(1)'></span>%
                    </div>
                </div>
            </template>
            <template v-else>
                <div class='flex-parent flex-parent--center-main'>
                    <div class='flex-child'>
                        <svg class='icon w30 h30'><use xlink:href='#icon-cursor'/></svg>
                    </div>
                </div>
                <div class='flex-parent flex-parent--center-main'>
                    <div class='flex-child'>
                        <div align=center>Hover for Details</div>
                    </div>
                </div>
            </template>
        </div>

        <div class='absolute z5 w180 bg-white round px12 py12' style='top: 12px; left: 12px;'>
            <div class='col col--12'>
                <label>Inference Type</label>
                <div class='select-container'>
                    <select v-model='layer' class='select'>
                        <template v-for='inf in inferences'>
                            <option v-bind:key='inf' v-text='inf'></option>
                        </template>
                    </select>
                    <div class='select-arrow'></div>
                </div>
            </div>
            <div class='col col--12 clearfix py12'>
                <button @click='bboxzoom' class='btn round btn--stroke fl btn--gray'><svg class='icon'><use xlink:href='#icon-viewport'/></svg></button>
            </div>

            <template v-if='!advanced'>
                <div class='col col--12'>
                    <button @click='advanced = !advanced' class='btn btn--white color-gray px0'><svg class='icon fl my6'><use xlink:href='#icon-chevron-right'/></svg><span class='fl pl6'>Advanced Options</span></button>
                </div>
            </template>
            <template v-else>
                <div class='col col--12 border-b border--gray-light mb12'>
                    <button @click='advanced = !advanced' class='btn btn--white color-gray px0'><svg class='icon fl my6'><use xlink:href='#icon-chevron-down'/></svg><span class='fl pl6'>Advanced Options</span></button>
                </div>
            </template>

            <template v-if='advanced'>
                <div class='grid grid--gut12 col col--12'>
                    <div class='col col--2'>
                        <label class='switch-container'>
                            <input v-model='raw' type='checkbox' />
                            <div class='switch'></div>
                        </label>
                    </div>
                    <div class='col col--10 pl24'>Raw Values</div>
                </div>

                <div class='none col col--12'>
                    <label>Opacity</label>
                    <div class='range range--s color-gray'>
                        <input type='range' />
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import buffer from '../node_modules/@turf/buffer/index.js';
import bboxPolygon from '../node_modules/@turf/bbox-polygon/index.js';

export default {
    name: 'chip-viz',
    data: function() {
        return {
            raw: false,
            layer: '',
            inspect: false,
            advanced: false,
            opacity: 0.5,
            map: false,
            inferences: [],
            bounds: false
        };
    },
    watch: {
        raw: function() {
            for (const inf of this.inferences) {
                this.map.setLayoutProperty(`inf-${inf}`, 'visibility', 'none');
                this.map.setLayoutProperty(`inf-${inf}-raw`, 'visibility', 'none');
            }

            this.map.setLayoutProperty(`inf-${this.layer}${this.raw ? '-raw' : ''}`, 'visibility', 'visible');
        },
        layer: function() {
            for (const inf of this.inferences) {
                this.map.setLayoutProperty(`inf-${inf}`, 'visibility', 'none');
                this.map.setLayoutProperty(`inf-${inf}-raw`, 'visibility', 'none');
            }

            this.map.setLayoutProperty(`inf-${this.layer}${this.raw ? '-raw' : ''}`, 'visibility', 'visible');
        },
    },
    mounted: function() {
        fetch('/api/meta', {
            method: 'get',
            credentials: 'same-origin'
        }).then((res) => {
            return res.json();
        }).then((res) => {
            let mapsettings = {
                container: 'map'
            }

            if (res.token) {
                mapboxgl.accessToken = res.token;
                mapsettings.style = 'mapbox://styles/mapbox/satellite-streets-v11'
            }

            this.inferences = res.inferences;
            this.bounds = res.bounds;
            this.layer = this.inferences[0];

            this.map = new mapboxgl.Map(mapsettings);
            this.map.addControl(new mapboxgl.NavigationControl());

            const polyouter = buffer(bboxPolygon(this.bounds), 0.3);
            const polyinner = buffer(bboxPolygon(this.bounds), 0.1);

            const poly = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        polyouter.geometry.coordinates[0],
                        polyinner.geometry.coordinates[0]
                    ]
                }
            };

            this.map.on('load', () => {
                this.bboxzoom();

                this.map.addSource('bbox', {
                    type: 'geojson',
                    data: poly
                });

                this.map.addLayer({
                    'id': `bbox-layer`,
                    'type': 'fill',
                    'source': 'bbox',
                    'paint': {
                        'fill-color': '#ffffff',
                        'fill-opacity': 1
                    }
                });

                this.map.addSource('inference', {
                    'type': 'vector',
                    'tiles': [
                        'http://localhost:1234/api/tiles/{z}/{x}/{y}.mvt'
                    ],
                    'minzoom': 1,
                    'maxzoom': 18
                });

                for (const inf of this.inferences) {
                    this.map.addLayer({
                        'id': `inf-${inf}`,
                        'type': 'fill',
                        'source': 'inference',
                        'source-layer': 'out',
                        'layout': {
                            'visibility': 'none'
                        },
                        'paint': {
                            'fill-color': '#ff0000',
                            'fill-opacity': [
                                "number",
                                [ '*', ["get", inf], this.opacity]
                            ]
                        }
                    });

                    this.map.addLayer({
                        'id': `inf-${inf}-raw`,
                        'type': 'fill',
                        'source': 'inference',
                        'source-layer': 'out',
                        'layout': {
                            'visibility': 'none'
                        },
                        'paint': {
                            'fill-color': '#00ff00',
                            'fill-opacity': [
                                "number",
                                ["get", `raw:${inf}`]
                            ]
                        }
                    });

                    this.map.on('mousemove', `inf-${inf}`, (e) => {
                        console.error(e.features[0]);
                        if (!e.features.length > 0|| !e.features[0].properties[`${this.raw ? 'raw:' : ''}${this.layer}`]) {
                            this.map.getCanvas().style.cursor = '';
                            this.inspect = false;
                            return;
                        }

                        this.map.getCanvas().style.cursor = 'pointer';

                        this.inspect = e.features[0].properties[`raw:${this.layer}`];
                    });

                    this.map.on('mousemove', `inf-${inf}-raw`, (e) => {
                        if (!e.features.length > 0|| !e.features[0].properties[`${this.raw ? 'raw:' : ''}${this.layer}`]) {
                            this.map.getCanvas().style.cursor = '';
                            this.inspect = false;
                            return;
                        }

                        this.map.getCanvas().style.cursor = 'pointer';

                        this.inspect = e.features[0].properties[`raw:${this.layer}`];
                    });
                }

                this.map.setLayoutProperty(`inf-${this.inferences[0]}`, 'visibility', 'visible');
            });
        }).catch((err) => {
            alert(err.message);
        });
    },
    methods: {
        bboxzoom: function() {
            this.map.fitBounds([
                [this.bounds[0], this.bounds[1]],
                [this.bounds[2], this.bounds[3]]
            ]);
        }
    }
}
</script>

