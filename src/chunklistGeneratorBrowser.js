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

function chunklistGeneratorBrowser(file, target_duration, final_callback, progress_callback) {

    //Read the local file in the browser

    //Instantiate class
    let segmenter = new chkGenerator.chunklistGenerator(file.name, target_duration);

    parseFile(file, function (err, data_chunk, read, total) {
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
    let file = document.getElementById('input-ts-file').files[0];

    if (file !== null) {
        console.log("Reading file!");

        //Show file name
        document.getElementById('input-ts-file-label').value = file.name;

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

        chunklistGeneratorBrowser(file, 4, final_callback, progress_callback);
    }
}

function showError(msg) {
    showResult(msg);
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

function showResult(data) {
    document.getElementById('result').innerHTML = '<pre><code>' + data + '</code></pre>';
}

//Start execution

document.getElementById('input-ts-file').addEventListener('change', onFileSelectHandle, false);

checkFileAPI();