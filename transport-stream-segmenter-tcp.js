#!/usr/bin/env node

//Jordi Cenzano 2017

const fs = require('fs');
const net = require('net');
const chkGenerator = require('./src/chunklistGenerator.js');

"use strict";

// Check input arguments
if (process.argv.length < 4) {
    console.log("Use: ./transport-stream-segmenter-tcp.js PORT CHUNKBASE_FILENAME OUTPUT_CHUNKLIST [TARGET_DUR_S] [BIND_ADDRESS]");
    console.log("Example: ./transport-stream-segmenter-tcp.js 5000 media_out.ts /tmp/out.m3u8 4 127.0.0.1");
    process.exit(1);
}

//Get conf filename
const port = process.argv[2];
const input_ts_base_filename = process.argv[3];
const out_chunklist_file = process.argv[4];

let target_dur_s = 4; //Default
if (process.argv.length > 5)
    target_dur_s = Number.parseInt(process.argv[5], 10);

let bind_addr = "127.0.0.1";
if (process.argv.length > 6)
    bind_addr = process.argv[6];

const server = net.createServer(function(socket) {

    // Identify this client
    socket.name = socket.remoteAddress + ":" + socket.remotePort;

    console.log("Connected: " + socket.name);

    //Instantiate class
    let segmenter = new chkGenerator.chunklistGenerator(input_ts_base_filename, target_dur_s, chkGenerator.enChunklistType.LIVE_EVENT);

    //Add chunk listener
    segmenter.addOnChunkListerer(function (that, chunklist) {
        console.log ("Saved new chunklist on: " + out_chunklist_file);
        fs.writeFileSync(out_chunklist_file, chunklist);
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

            fs.writeFileSync(out_chunklist_file, chunklist);

            console.log("Finished! Created: " + out_chunklist_file);
        });
    });

    // Error
    socket.on('error', function (err) {
        console.error(err);
    });
});

server.listen(port, bind_addr);

console.log("Server listening on port: " + port.toString() + ". BindAddr: " + bind_addr);

