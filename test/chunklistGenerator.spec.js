const fs = require('fs');
const path = require('path');

const assert = require('assert');

const underTest = require('../src/chunklistGenerator.js');

const moduleDir = __dirname;

describe('chunklist-generator', function() {

    let input_vod_file_name = path.join(moduleDir,'fixtures/test_320x200a30fps.ts');
    let base_path = moduleDir; //Test dir
    let out_path = path.join(base_path, 'results');

    //Clean results directory
    before(function() {
        fs.readdir(out_path, function (err, files) {
            if (!err) {
                for (var i = 0, len = files.length; i < len; i++) {
                    var match = files[i].match(/.*\.ts|.*\.m3u8/);
                    if(match !== null)
                        fs.unlinkSync(path.join(out_path,match[0]));
                }
            }
        });
    });

    describe('generate a VOD chunklist from file', function () {

        it('ffmpeg generated ts', function (done) {
            let segmenter = new underTest.chunklistGenerator(false, null, input_vod_file_name, 4);

            let readFileStream = new fs.createReadStream(input_vod_file_name);

            readFileStream.on("error", function() {
                assert.fail('error reading the file');
            });

            readFileStream.on("data", function(ts_packet_chunk) {

                segmenter.processDataChunk(ts_packet_chunk, function (err) {
                    assert.equal(err, null);
                });
            });

            //Check chunklist
            readFileStream.on("end", function() {
                segmenter.processDataEnd(function (err, data) {
                    assert.equal(err, null);

                    assert.equal(data,
                        `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-VERSION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-MAP:URI="test_320x200a30fps.ts",BYTERANGE="376@188"
#EXTINF:3.9000000000000004,
#EXT-X-BYTERANGE:208304@564
test_320x200a30fps.ts
#EXTINF:3.9000000000000004,
#EXT-X-BYTERANGE:251732@208868
test_320x200a30fps.ts
#EXTINF:1.9000000000000004,
#EXT-X-BYTERANGE:129344@460600
test_320x200a30fps.ts
#EXT-X-ENDLIST`);

                    done();
                });
            });
        });
    });

    describe('generate a live event chunklist and chunks from file', function () {

        //TODO: Add check for files & no 0 size

        it('ffmpeg generated ts', function (done) {
            let chunk_base_filename = 'test_with_chunks_event_';
            let chunklist_filename = path.join(out_path, path.parse(input_vod_file_name).name + '_event.m3u8');

            let segmenter = new underTest.chunklistGenerator(true, out_path, chunk_base_filename, 4, underTest.enChunklistType.LIVE_EVENT);

            let readFileStream = new fs.createReadStream(input_vod_file_name);

            readFileStream.on("error", function() {
                assert.fail('error reading the file');
            });

            readFileStream.on("data", function(ts_packet_chunk) {

                segmenter.processDataChunk(ts_packet_chunk, function (err) {
                    assert.equal(err, null);
                });
            });

            readFileStream.on("end", function() {
                segmenter.processDataEnd(function (err, data) {
                    assert.equal(err, null);

                    //Check chunklist
                    assert.equal(data,
                        `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-VERSION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:EVENT
#EXT-X-MAP:URI="test_with_chunks_event_init.ts"
#EXTINF:3.9000000000000004,
test_with_chunks_event_00000.ts
#EXTINF:3.9000000000000004,
test_with_chunks_event_00001.ts
#EXTINF:1.9000000000000004,
test_with_chunks_event_00002.ts
#EXT-X-ENDLIST`);

                    //Save chunklist (for testing purposes)
                    fs.writeFileSync(chunklist_filename, data);

                    //Check chunk files
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + 'init.ts')), true);
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00000.ts')), true);
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00001.ts')), true);
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00002.ts')), true);

                    done();
                });
            });
        });
    });

    describe('generate a live window (2 chunks) chunklist and chunks from file', function () {

        it('ffmpeg generated ts', function (done) {
            let chunk_base_filename = 'test_with_chunks_live_';
            let chunklist_filename = path.join(out_path, path.parse(input_vod_file_name).name + '_live.m3u8');

            let segmenter = new underTest.chunklistGenerator(true, out_path, chunk_base_filename, 4, underTest.enChunklistType.LIVE_WINDOW, 2);

            let readFileStream = new fs.createReadStream(input_vod_file_name);

            readFileStream.on("error", function() {
                assert.fail('error reading the file');
            });

            readFileStream.on("data", function(ts_packet_chunk) {

                segmenter.processDataChunk(ts_packet_chunk, function (err) {
                    assert.equal(err, null);
                });
            });

            readFileStream.on("end", function() {
                segmenter.processDataEnd(function (err, data) {
                    assert.equal(err, null);

                    //Check chunklist
                    assert.equal(data,
                        `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-VERSION:6
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-MAP:URI="test_with_chunks_live_init.ts"
#EXTINF:3.9000000000000004,
test_with_chunks_live_00001.ts
#EXTINF:1.9000000000000004,
test_with_chunks_live_00002.ts
#EXT-X-ENDLIST`);

                    //Save chunklist (for testing purposes)
                    fs.writeFileSync(chunklist_filename, data);

                    //Check chunk files
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + 'init.ts')), true);
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00001.ts')), true);
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00002.ts')), true);

                    done();
                });
            });
        });
    });

    describe('LHLS generate a live window (2 chunks) chunklist and chunks from file', function () {

        it('ffmpeg generated ts', function (done) {
            let chunk_base_filename = 'test_lhls_with_chunks_live_';
            let chunklist_filename = path.join(out_path, path.parse(input_vod_file_name).name + '_live.m3u8');

            let segmenter = new underTest.chunklistGenerator(true, out_path, chunk_base_filename, 4, underTest.enChunklistType.LIVE_WINDOW, 3, 3);

            let readFileStream = new fs.createReadStream(input_vod_file_name);

            //Add chunk listener
            let chunklist_num = 0;
            segmenter.setOnChunkListerer(function (that, chunklist) {
                if (chunklist !== null) {
                    if (chunklist_num === 0) {
                        assert.equal(chunklist, `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-VERSION:6
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-MAP:URI="test_lhls_with_chunks_live_init.ts"
#EXTINF:4,
test_lhls_with_chunks_live_00001.ts
#EXTINF:4,
test_lhls_with_chunks_live_00002.ts
#EXTINF:4,
test_lhls_with_chunks_live_00003.ts`);

                        //Check chunk files
                        assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + 'init.ts')), true);
                        assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00001.ts')), true);
                        assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00002.ts')), true);
                        assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00003.ts')), true);
                    }
                    else if (chunklist_num === 1) {
                        assert.equal(chunklist, `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-VERSION:6
#EXT-X-MEDIA-SEQUENCE:2
#EXT-X-MAP:URI="test_lhls_with_chunks_live_init.ts"
#EXTINF:4,
test_lhls_with_chunks_live_00002.ts
#EXTINF:4,
test_lhls_with_chunks_live_00003.ts
#EXTINF:4,
test_lhls_with_chunks_live_00004.ts`);

                        //Check chunk files
                        assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + 'init.ts')), true);
                        assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00002.ts')), true);
                        assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00003.ts')), true);
                        assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00004.ts')), true);
                    }
                    chunklist_num++;
                }
            }, this);

            readFileStream.on("error", function() {
                assert.fail('error reading the file');
            });

            readFileStream.on("data", function(ts_packet_chunk) {

                segmenter.processDataChunk(ts_packet_chunk, function (err) {
                    assert.equal(err, null);
                });
            });

            readFileStream.on("end", function() {
                segmenter.processDataEnd(function (err, data) {
                    assert.equal(err, null);

                    //Check final chunklist
                    assert.equal(data,
                        `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-VERSION:6
#EXT-X-MEDIA-SEQUENCE:2
#EXT-X-MAP:URI="test_lhls_with_chunks_live_init.ts"
#EXTINF:4,
test_lhls_with_chunks_live_00002.ts
#EXTINF:4,
test_lhls_with_chunks_live_00003.ts
#EXTINF:4,
test_lhls_with_chunks_live_00004.ts
#EXT-X-ENDLIST`);

                    //Save chunklist (for testing purposes)
                    fs.writeFileSync(chunklist_filename, data);

                    //Check chunk files
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + 'init.ts')), true);
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00001.ts')), true);
                    assert.equal(fs.existsSync(path.join(out_path, chunk_base_filename + '00002.ts')), true);

                    done();
                });
            });
        });
    });
});
