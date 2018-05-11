#!/usr/bin/env node

//Jordi Cenzano 2017

const fs = require('fs');
const path = require('path');
const net = require('net');
const chkGenerator = require('./src/chunklistGenerator.js');

"use strict";

// Check input arguments
if (process.argv.length < 4) {
    console.log('Use: ./transport-stream-segmenter-tcp.js PORT BASE_OUTPUT_PATH CHUNK_BASE_FILENAME CHUNKLIST_FILENAME [TARGET_DUR_S] [BIND_ADDRESS] [CHUNKLIST_TYPE]');
    console.log('Example: ./transport-stream-segmenter-tcp.js 5000 /tmp media_ out.m3u8 4 127.0.0.1 event');
    process.exit(1);
}

//Get conf filename
const port = process.argv[2];
const base_path = process.argv[3];
const chunk_base_filename = process.argv[4];
const chunklist_file_name = process.argv[5];

let target_dur_s = 4; //Default
if (process.argv.length > 6)
    target_dur_s = Number.parseInt(process.argv[6], 10);

let bind_addr = "";
if (process.argv.length > 7)
    bind_addr = process.argv[7];

let chunklist_type = chkGenerator.enChunklistType.LIVE_WINDOW;
if (process.argv.length > 8) {
    if (process.argv[8] === chkGenerator.enChunklistType.LIVE_EVENT)
        chunklist_type = chkGenerator.enChunklistType.LIVE_EVENT;
}

//Chunklist full path
const out_chunklist_file = path.join(base_path, chunklist_file_name);

//Function saves chunklist file
function saveChunklist(file_name, data) {
    fs.writeFileSync(file_name, data);

    console.log ("Saved new chunklist on: " + file_name);
}

//Create TCP server
const server = net.createServer(function(socket) {
    //NEW CONNECTION!

    // Identify this client
    socket.name = socket.remoteAddress + ":" + socket.remotePort;

    console.log("Connected: " + socket.name);

    //Instantiate class
    let segmenter = new chkGenerator.chunklistGenerator(true, base_path, chunk_base_filename, target_dur_s, chunklist_type);
    const numAdvanceChunks = 3;
    let forcePush = false;

    // Creating blank chunks
    for (let i = 0; i < numAdvanceChunks; i++) {
        if (segmenter.segmenter_data.chunk === null) {
            forcePush = true;
        }

        segmenter.chunklist_generator.setMediaIniInfo(segmenter.segmenter_data.media_info);

        segmenter._createNewChunk(false);

        segmenter.segmenter_data.chunk.index = i;

        if (i === 0) {
            segmenter.first_advance_chunk = segmenter.segmenter_data.chunk;
            segmenter.advance_chunks_filled = false;
        }

        // Forcible push for the first chunk
        if (forcePush) {
            segmenter.segmenter_data.chunks_info.push(segmenter.segmenter_data.chunk);
            forcePush = false;
        }


    }

    saveChunklist(out_chunklist_file, segmenter.chunklist_generator.toString(false));

    //Add chunk listener
    segmenter.setOnChunkListerer(function (that, chunklist) {
        saveChunklist(out_chunklist_file, chunklist);
    }, this);

    // Handle incoming messages from clients.
    socket.on('data', function (chunk) {
        segmenter.processDataChunk(chunk, function (err) {
            if (err) {
                socket.destroy();
                console.error(err);
            }
        });
    });

    // Remove the client from the list when it leaves
    socket.on('end', function () {
        segmenter.processDataEnd(function (err, chunklist) {
            if (err)
                console.error(err);

            saveChunklist(out_chunklist_file, chunklist);

            console.log("Finished! Created: " + out_chunklist_file);
        });
    });

    // Error
    socket.on('error', function (err) {
        console.error(err);
    });
});

if (bind_addr != "") {
    server.listen(port, bind_addr);
    console.log("Server listening on port: " + port.toString());
}
else {
    server.listen(port);
    console.log("Server listening on port: " + port.toString() + ". BindAddr: " + bind_addr);
}
