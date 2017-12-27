const http = require("http");
const https = require("https");
const chkGenerator = require('./chunklistGenerator.js');

"use strict";

function checkFileAPI() {
    // Check for the various File API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        // Great success! All the File APIs are supported.
    }
    else {
        alert('The File APIs are not fully supported in this browser.');
    }
}

function chunklistGeneratorBrowser(is_url, source, target_duration, final_callback, progress_callback) {
    let file_name_url = source.name;
    let processFunction = parseFile;
    if (is_url === true) {
        file_name_url = source;
        processFunction = parseURL
    }

    //Instantiate class
    let segmenter = new chkGenerator.chunklistGenerator(file_name_url, target_duration);

    processFunction(source, function (err, data_chunk, read, total) {
        if (err) {
            return final_callback(err, null);
        }
        else {
            if (data_chunk !== null) {
                //Process data chunk
                segmenter.processDataChunk(data_chunk, function (err) {
                    if (err)
                        return final_callback(err, null);

                    if (typeof (progress_callback) === 'function')
                        return progress_callback(read, total);
                });
            }
            else {
                //END
                segmenter.processDataEnd(function (err, chunklist) {
                    if (err)
                        return final_callback(err, null);

                    return final_callback(null, chunklist);
                });
            }
        }
    });
}

function onFileSelectHandle(evt) {
    let is_url = false;

    let source = document.getElementById('input-ts-file').files[0];

    //Show file name
    if (source !== null)
        document.getElementById('input-ts-file-label').value = source.name;

    startTSWebProcess(is_url, source);
}


function onURLProcessClick() {
    let is_url = true;
    let source = document.getElementById('input-ts-url').value;

    //Remove file value
    document.getElementById('input-ts-file-label').value = "";

    startTSWebProcess(is_url,source);
}

function startTSWebProcess(is_url, source) {

    let elemTargetDur = document.getElementById('target_dur_s');
    let target_dur = elemTargetDur.options[elemTargetDur.selectedIndex].value;

    if (source !== null) {
        console.log("Reading source!");

        let final_callback = function (err, data) {
            if (err) {
                showError(err);
            }
            else {
                showResult(data);
            }
        };

        let progress_callback = function (read, total) {
            showResult('Processed: ' + read.toString() + '/' + total.toString());
        };

        chunklistGeneratorBrowser(is_url, source, target_dur, final_callback, progress_callback);
    }
}

//From: https://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
function parseFile(file, callback) {
    let fileSize   = file.size;
    let chunkSize  = 64 * 1024; // 64Kbytes
    let offset     = 0;
    let chunkReaderBlock = null;

    let readEventHandler = function(evt) {
        if (evt.target.error !== null) {
            console.error("Read error: " + evt.target.error);
            return  callback(evt.target.error, null);
        }

        offset += evt.target.result.byteLength;

        if (offset > 0) {
            let buff= Buffer.from(evt.target.result);

            callback(null, buff, offset, fileSize); // callback for handling read chunk
        }

        if (offset >= fileSize) {
            console.log("Done reading file");
            return callback(null, null, offset, fileSize);
        }

        //Next chunk
        chunkReaderBlock(offset, chunkSize, file);
    };

    chunkReaderBlock = function(_offset, length, _file) {
        let r = new FileReader();
        let blob = _file.slice(_offset, length + _offset);
        r.onload = readEventHandler;
        r.readAsArrayBuffer(blob);
    };

    // now let's start the read with the first block
    chunkReaderBlock(offset, chunkSize, file);
}

function parseURL(url, callback) {
    let fileSize   = -1;
    let offset     = 0;

    let prot = https;
    if (url.toLowerCase().search("http:") === 0)
        prot = http;

    return prot.get(url, function (response) {
        if (fileSize < 0)
            fileSize = parseInt(response.headers['content-length']);

        //NO redirects
        if (response.statusCode >= 300) {
            let err = new Error("Response status:" + response.statusCode);
            return callback(err); // callback for handling read chunk
        }

        response.on('data', function (chunk) {
            offset += chunk.length;

            callback(null, chunk, offset, fileSize); // callback for handling read chunk
        });

        response.on('end', function () {
            console.log("Done reading file");
            return callback(null, null, offset, fileSize);
        });

        response.on('end', function () {
            console.log("Done reading file");
            return callback(null, null, offset, fileSize);
        });
    });
}

function showError(msg) {
    showResult(msg);
}

function showResult(data) {
    document.getElementById('result').innerHTML = '<pre><code>' + data + '</code></pre>';
}

function onFileSourceChange() {
    if (document.getElementById('input-file-local').checked === true) {
        document.getElementById('input-file').style.display = "table";
        document.getElementById('input-url').style.display = "none";
    }
    else if (document.getElementById('input-file-url').checked === true) {
        document.getElementById('input-file').style.display = "none";
        document.getElementById('input-url').style.display = "block";
    }
}

//Start execution

document.getElementById('input-ts-file').addEventListener('change', onFileSelectHandle, false);

document.getElementById('input-file-selector').addEventListener('click', onFileSourceChange, false);

document.getElementById('input-file-url-process').addEventListener('click', onURLProcessClick, false);

checkFileAPI();