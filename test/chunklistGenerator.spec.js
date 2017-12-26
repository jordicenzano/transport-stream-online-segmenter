const fs = require('fs');
const path = require('path');

const assert = require('assert');

const underTest = require('../src/chunklistGenerator.js');

const moduleDir = __dirname;

describe('chunklist-generator', function() {
    describe('generate a chunklist', function () {

        it('ffmpeg generated ts', function (done) {

            let input_file_name = path.join(moduleDir,'fixtures/test_320x200a30fps.ts');

            let segmenter = new underTest.chunklistGenerator(input_file_name, 4);

            let readFileStream = new fs.createReadStream(input_file_name);

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
});
