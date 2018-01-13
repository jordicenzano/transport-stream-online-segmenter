#!/usr/bin/env node

//Jordi Cenzano 2017

const fs = require('fs');
const path = require('path');
const chkGenerator = require('./src/chunklistGenerator.js');

"use strict";

// Check input arguments
if (process.argv.length < 4) {
    console.log("Use: ./transport-stream-segmenter-cli.js INPUT_TS OUTPUT_CHUNKLIST [TARGET_DUR_S]");
    console.log("Example: ./transport-stream-segmenter-cli.js /tmp/input.ts /tmp/out.m3u8 4");
    process.exit(1);
}

//Get conf filename
const input_ts_file = process.argv[2];
const out_chunklist_file = process.argv[3];
let target_dur_s = 4; //Default
if (process.argv.length > 4)
    target_dur_s = Number.parseInt(process.argv[4], 10);

const base_path = path.dirname(out_chunklist_file);

//Instantiate class
let segmenter = new chkGenerator.chunklistGenerator(false, base_path, input_ts_file, target_dur_s);

//Create file reader
const readStream = fs.createReadStream(input_ts_file);

readStream.on('data', function (chunk) {

    segmenter.processDataChunk(chunk, function (err) {
        if (err) {
            readStream.destroy();
            console.error(err);
            return 1;
        }
    });
});

readStream.on('end', function () {
    segmenter.processDataEnd(function (err, chunklist) {
        if (err) {
            console.error(err);
            return 1;
        }

        fs.writeFileSync(out_chunklist_file, chunklist);

        console.log("Finished! Created: " + out_chunklist_file);
        return 0;
    });
});

readStream.on('error', function (err) {
    console.error(err);
    return 1;
});

