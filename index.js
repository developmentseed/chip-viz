#!/usr/bin/env node

const os = require('os');
const fs = require('fs');
const turf = require('@turf/turf');
const path = require('path');
const csv = require('csv');
const stream = require('stream');
const Tippecanoe = require('./lib/tippecanoe');
const tilebelt = require('@mapbox/tilebelt');
const express = require('express');
const objectAssign = require('object-assign');
const MBTiles = require('@mapbox/mbtiles');
const args = require('minimist')(process.argv, {
    boolean: ['help'],
    string: ['tiles', 'inferences', 'token'],
    alias: {
        tiles: 'tile'
    }
});

let token = process.env.MAPBOX_ACCESS_TOKEN;

const app = express();
app.use('/', express.static(path.resolve(__dirname, 'web/dist/')));

if (args.token) {
    token = args.token;
}

if (!args.tiles) {
    args.tiles = path.resolve(os.tmpdir(), 'chip_viz.mbtiles');
}

if (!args._[2] || args.help) {
    console.error();
    console.error('Visualize Tile Based ML data');
    console.error();
    console.error('Usage: ./index.js <inferences.csv> [--tiles <file>] [--inferences <a,b,...>');
    console.error('           [--token <Mapbox API Token>] [--help]');
    console.error();
    process.exit();
} else if (!args.inferences) {
    console.error();
    console.error('  --inferences arg must be specified');
    console.error();
    process.exit();
} else if (!token) {
    console.error();
    console.error('  A Mapbox Access Token must be specified with the --token flag');
    console.error('  or via an environment variable: MAPBOX_PLACES_ADDRESS');
    console.error();
    process.exit();
} else {
    args.inferences = args.inferences.split(',').map(inf => inf.trim());

    fs.stat(path.resolve(__dirname, args.tiles), (err, stats) => {
        if (stats) fs.unlinkSync(path.resolve(__dirname, args.tiles));

        read();
    });
}

async function read() {

    const tippecanoe = new Tippecanoe();

    let first = true;
    const feats = fs.createReadStream(path.resolve(__dirname, args._[2]))
        .pipe(csv.parse())
        .pipe(csv.transform((record) => {
            if (first) {
                first = false;
                return '';
            }

            const tile = turf.feature(tilebelt.tileToGeoJSON(record[1].split('-').map(t => parseInt(t))));

            const inferences = JSON.parse(record[3]);
            const thresholds = JSON.parse(record[2]);
            for (let i = 0; i < args.inferences.length; i++) {
                tile.properties[`raw:${args.inferences[i]}`] = inferences[i]
                tile.properties[args.inferences[i]] = thresholds[i]
            }

            return JSON.stringify(tile) + '\n';
        }));

    try {
        await tippecanoe.tile(feats, path.resolve(__dirname, args.tiles), {
            zoom: {
                max: 18
            },
            stdout: true
        });
    } catch(err) {
        console.error(err);
        process.exit(1);
    }

    new MBTiles(path.resolve(__dirname, args.tiles), ((err, tiles) => {
        if (err) throw err;

        tiles.getInfo((err, info) => {
            if (err) throw err;

            const tileset = objectAssign({}, info, {
                tiles: tiles
            });

            tileset.token = token;
            tileset.inferences = args.inferences;

            app.get('/api/meta', (req, res) => {
                res.json(tileset);
            });

            app.get('/api/tiles/:z/:x/:y.mvt', (req, res) => {
                tileset.tiles.getTile(req.params.z, req.params.x, req.params.y, (err, tile, headers) => {
                    if (err) {
                        res.end();
                    } else {
                        res.writeHead(200, headers);
                        res.end(tile);
                    }
                });
            });

            app.listen(1234, () => {
                console.error('http://localhost:1234');
            });

        });
    }));
}
