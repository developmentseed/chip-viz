<template>
    <div id="app">
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
                        <span v-text='this.layer'></span>: <span v-text='(this.inspect * 100).tofixed(1)'></span>%
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
                        <div align=center>hover for details</div>
                    </div>
                </div>
            </template>
        </div>

        <div class='absolute z5 w180 bg-white round px12 py12' style='top: 12px; left: 12px;'>
            <div class='col col--12'>
                <label>inference type</label>
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
            <div class='grid grid--gut12 col col--12'>
                <div class='col col--2'>
                    <label class='switch-container'>
                        <input v-model='raw' type='checkbox' />
                        <div class='switch'></div>
                    </label>
                </div>
                <div class='col col--10 pl24'>raw values</div>
            </div>
        </div>
    </div>
</template>

<script>
import turf from '@turf/turf';

export default {
    name: 'chip-viz',
    data: function() {
        return {
            raw: false,
            layer: '',
            inspect: false,
            map: false,
            inferences: [],
            bounds: false
        };
    },
    watch: {
        raw: function() {
            for (const inf of this.inferences) {
                this.map.setlayoutproperty(`inf-${inf}`, 'visibility', 'none');
                this.map.setlayoutproperty(`inf-${inf}-raw`, 'visibility', 'none');
            }

            this.map.setlayoutproperty(`inf-${this.layer}${this.raw ? '-raw' : ''}`, 'visibility', 'visible');
        },
        layer: function() {
            for (const inf of this.inferences) {
                this.map.setlayoutproperty(`inf-${inf}`, 'visibility', 'none');
                this.map.setlayoutproperty(`inf-${inf}-raw`, 'visibility', 'none');
            }

            this.map.setlayoutproperty(`inf-${this.layer}${this.raw ? '-raw' : ''}`, 'visibility', 'visible');
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
                mapboxgl.accesstoken = res.token;
                mapsettings.style = 'mapbox://styles/mapbox/satellite-streets-v11'
            }

            this.inferences = res.inferences;
            this.bounds = res.bounds;
            this.layer = this.inferences[0];

            this.map = new mapboxgl.map(mapsettings);
            this.map.addcontrol(new mapboxgl.navigationcontrol());

            const polyouter = turf.buffer(turf.bboxpolygon(this.bounds), 0.3);
            const polyinner = turf.buffer(turf.bboxpolygon(this.bounds), 0.1);

            const poly = {
                type: 'feature',
                properties: {},
                geometry: {
                    type: 'polygon',
                    coordinates: [
                        polyouter.geometry.coordinates[0],
                        polyinner.geometry.coordinates[0]
                    ]
                }
            };

            this.map.on('load', () => {
                this.bboxzoom();

                this.map.addsource('bbox', {
                    type: 'geojson',
                    data: poly
                });

                this.map.addlayer({
                    'id': `bbox-layer`,
                    'type': 'fill',
                    'source': 'bbox',
                    'paint': {
                        'fill-color': '#ffffff',
                        'fill-opacity': 1
                    }
                });

                this.map.addsource('inference', {
                    'type': 'vector',
                    'tiles': [
                        'http://localhost:1234/api/tiles/{z}/{x}/{y}.mvt'
                    ],
                    'minzoom': 1,
                    'maxzoom': 18
                });

                for (const inf of this.inferences) {
                    this.map.addlayer({
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
                                [ '*', ["get", inf], 0.5]
                            ]
                        }
                    });

                    this.map.addlayer({
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
                        if (!e.features.length > 0|| !e.features[0].properties[`${this.raw ? 'raw:' : ''}${this.layer}`]) {
                            this.map.getcanvas().style.cursor = '';
                            this.inspect = false;
                            return;
                        }

                        this.map.getcanvas().style.cursor = 'pointer';

                        this.inspect = e.features[0].properties[`raw:${this.layer}`];
                    });

                    this.map.on('mousemove', `inf-${inf}-raw`, (e) => {
                        if (!e.features.length > 0|| !e.features[0].properties[`${this.raw ? 'raw:' : ''}${this.layer}`]) {
                            this.map.getcanvas().style.cursor = '';
                            this.inspect = false;
                            return;
                        }

                        this.map.getcanvas().style.cursor = 'pointer';

                        this.inspect = e.features[0].properties[`raw:${this.layer}`];
                    });
                }

                this.map.setlayoutproperty(`inf-${this.inferences[0]}`, 'visibility', 'visible');
            });
        }).catch((err) => {
            alert(err.message);
        });
    },
    methods: {
        bboxZoom: function() {
            this.map.fitBounds([
                [this.bounds[0], this.bounds[1]],
                [this.bounds[2], this.bounds[3]]
            ]);
        }
    }
}
</script>

