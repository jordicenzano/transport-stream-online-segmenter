const path = require('path');

const tspck = require('./tspacket.js');
const tspckParserMod = require('./tspacket_parser');

const hlsChunk = require('./hls_chunk.js');
const hls_media_info = require('./hls_media_info.js');
const hlsChunklist = require('./hls_chunklist.js');

"use strict";

const TS_PACKET_SIZE = 188;

// Constructor
class chunklistGenerator {

    constructor(is_creating_chunks, base_path, chunk_base_filename, target_segment_dur_s, chunklist_type, live_window_size, lhls_advanced_chunks) {

        //Create packet parsers. According to the docs it is compiled at first call, so we can NOT create it inside packet (time consuming)
        this.tspckParser = new tspckParserMod.tspacketParser().getPacketParser();
        this.tspckPATParser = new tspckParserMod.tspacketParser().getPATPacketParser();
        this.tspckPMTParser = new tspckParserMod.tspacketParser().getPMTPacketParser();

        this.chunklist_type = hlsChunklist.enChunklistType.VOD;
        if (typeof(chunklist_type) === 'string') {
            if (chunklist_type === hlsChunklist.enChunklistType.LIVE_EVENT)
                this.chunklist_type = hlsChunklist.enChunklistType.LIVE_EVENT;
            else if (chunklist_type === hlsChunklist.enChunklistType.LIVE_WINDOW)
                this.chunklist_type = hlsChunklist.enChunklistType.LIVE_WINDOW;
        }

        this.lhls_advanced_chunks = 0;
        this.is_lhls = false;
        if ((Number.isInteger(lhls_advanced_chunks)) && (lhls_advanced_chunks > 0)) {
            this.lhls_advanced_chunks = lhls_advanced_chunks;
            this.is_lhls = true;
        }

        let chunklist_options = {
            is_splitting_chunks: is_creating_chunks,
            is_using_relative_path: true,
            is_lhls: this.is_lhls
        };

        if (typeof (live_window_size) === 'number')
            chunklist_options.live_window_size = live_window_size;

        this.chunklist_generator = new hlsChunklist.hls_chunklist(this.chunklist_type, path.basename(chunk_base_filename), chunklist_options);

        this.result_chunklist = "";

        this.on_chunk = null;
        this.on_chunk_data = null;

        this.segmenter_data = {
            config: {
                base_path: base_path,
                chunk_base_filename: chunk_base_filename,
                is_creating_chunks: is_creating_chunks,

                packet_expected_length: TS_PACKET_SIZE,

                //Only 1 video allowed
                break_at_video_idr: true,
                target_segment_duration_s: target_segment_dur_s,
                target_segment_duration_tolerance: 0.25
            },

            //Params for read TS
            curr_file_pos_byte: 0,
            segment_index: 0,
            bytes_next_sync: 0,

            //Current TS packet
            ts_packet: null,

            //Chunks
            _chunks: [],

            //Media init info (PAT + PMT)
            media_info: new hls_media_info.hls_media_info(),

            getCurrentChunk() {
                let ret = null;

                if (this._chunks.length > 0)
                    ret = this._chunks[0];

                return ret;
            }
        };

        if (this.segmenter_data.config.is_creating_chunks)
            this.segmenter_data.media_info.setFileName(path.join(this.segmenter_data.config.base_path, path.basename(this.segmenter_data.config.chunk_base_filename) + "init.ts"));
    }

    processDataChunk(data, callback) {
        try {
            this._process_data_chunk(data);
        }
        catch(err) {
            return callback(err);
        }

        return callback(null);
    }

    processDataEnd(callback) {
        try {
            //Process remaining TS packets
            this._process_data_finish();

            this.result_chunklist = this.chunklist_generator.toString(true);
        }
        catch (err) {
            return callback(err, null);
        }

        return callback(null, this.result_chunklist);
    }

    setOnChunkListerer(callback, data) {
        this.on_chunk = callback;
        this.on_chunk_data = data;
    }

    removeOnChunkListerer() {
        this.on_chunk = null;
        this.on_chunk_data = null;
    }

    _closeAllChunks() {
        let is_closed = false;
        do {

            is_closed = this._closeChunk(this.segmenter_data._chunks.shift());

        } while (is_closed);
    }

    _addChunkToChunklist(chunk) {
        this.chunklist_generator.addChunk(chunk);

        console.log("Added chunk: " + this._chunkInfoToString(chunk));
    }

    _closeCurrentChunk() {
        const chunk = this.segmenter_data.getCurrentChunk();

        this._closeChunk(chunk);

        return chunk;
    }

    _closeChunk(chunk) {
        let ret = false;

        //Close current chunk
        if (chunk != null) {
            chunk.close();
            console.log("Close chunk: " + this._chunkInfoToString(chunk));

            ret = true;
        }

        return ret;
    }

    _createNewChunk(is_lhls) {
        let is_first_chunk = false;

        const chunk_closed = this._closeCurrentChunk();
        if (chunk_closed != null) {
            //Add chunk info to chunklist after the chunk is closed if is NOT LHLS
            if (!is_lhls) {
                this._addChunkToChunklist(chunk_closed);
            }
        }
        else {
            is_first_chunk = true;
        }

        //Create chunk options
        let chunk_options = null;
        if (this.segmenter_data.config.is_creating_chunks) {
            chunk_options = {
                base_path: this.segmenter_data.config.base_path,
                chunk_base_file_name: this.segmenter_data.config.chunk_base_filename
            };

            if (is_lhls) {
                //Add the estimated time if LHLS is active
                chunk_options.estimated_duration_s = this.segmenter_data.config.target_segment_duration_s;
            }
        }

        //Create chunks
        let chunks_to_create = 1;
        if (is_lhls) {
            if (is_first_chunk) {
                chunks_to_create = this.lhls_advanced_chunks;
            }
        }

        //Create new chunks
        for (let n = 0; n < chunks_to_create; n++) {
            const chunk_new = new hlsChunk.hls_chunk(this.segmenter_data.segment_index, chunk_options);
            this.segmenter_data._chunks.push(chunk_new);
            this.segmenter_data.segment_index++;

            //Add chunks to chunklist at creation time for LHLS
            if (is_lhls) {
                this._addChunkToChunklist(chunk_new);
            }
        }

        //Remove oldest chunk
        if (this.segmenter_data._chunks.length > chunks_to_create) {
                this.segmenter_data._chunks.shift();
        }

        //Send event
        if (this.on_chunk !== null) {
            //Generate chunklist
            this.on_chunk(this.on_chunk_data, this.chunklist_generator.toString(false));
        }
    }

    _chunkInfoToString(chunk) {
        let ret = "";
        if (chunk !== null) {
            ret = "Index: " + chunk.getIndex().toString() + ". Packets: " + chunk.getNumTSPackets().toString() + ". Duration: " + chunk.getDuration().toString() + ". Estimated duration: " + chunk.getEstimatedDuration().toString();
        }

        return ret;
    }

    _process_data_finish() {
        //Send the the one currently processing to the chunlist
        if (!this.is_lhls)
            this._addChunkToChunklist(this.segmenter_data.getCurrentChunk());

        this._closeAllChunks(this.is_lhls);
    }

    _getMediaInfoData(is_creating_chunks, media_info, ts_packet) {
        let ret = false;

        if (ts_packet.isPAT()) {
            let pmtsData = ts_packet.getPMTsIDs();
            if ((Array.isArray(pmtsData)) && (pmtsData.length > 1)) {
                throw new Error("More than 1 PMT not supported!!");
            }
            else {
                media_info.setPat(pmtsData[0].pmtID, ts_packet.getFirstBytePos(), ts_packet.getLastBytePos());

                if (is_creating_chunks)
                    media_info.addTSPacket(ts_packet);
            }
        }
        else if (ts_packet.isID(media_info.getPmtId())) {
            let esInfo = ts_packet.getESInfo();

            if (Array.isArray(esInfo)) {
                let i = 0;
                while ((media_info.getVideoPid() < 0) && (i < esInfo.length)) {

                    if (tspck.tspacket.isStreamTypeVideo(esInfo[i].streamType))
                        media_info.setVideoPid(esInfo[i].elementaryPID);

                    i++;
                }
            }

            media_info.setPmt(ts_packet.getFirstBytePos(), ts_packet.getLastBytePos());
            if (is_creating_chunks)
                media_info.addTSPacket(ts_packet);
        }

        if (is_creating_chunks && media_info.getIsSet() && !media_info.getIsSaved())
            media_info.save();

        if (media_info.getIsSet())
            ret = true;

        return ret;
    }

    _process_data_chunk(data) {
        let curr_packet_start = 0;
        let curr_packet_end = 0;

        //Create initial packet
        if (this.segmenter_data.ts_packet === null)
            this.segmenter_data.ts_packet = new tspck.tspacket(this.segmenter_data.packet_size, this.tspckParser, this.tspckPATParser, this.tspckPMTParser);

        if (this.segmenter_data.getCurrentChunk() === null)
            this._createNewChunk(this.is_lhls);

        if (data.length <= this.segmenter_data.bytes_next_sync) {
            this.segmenter_data.bytes_next_sync = this.segmenter_data.bytes_next_sync - data.length;

            //Create ts packet buffet
            this.segmenter_data.ts_packet.addDataWithPos(this.segmenter_data.curr_file_pos_byte, data);
        }
        else {
            let sync_index = this.segmenter_data.bytes_next_sync;
            let bexit = false;
            while (bexit === false) {
                if (data[sync_index] === 0x47) {

                    //New packet detected
                    curr_packet_end = sync_index;
                    this.segmenter_data.ts_packet.addDataWithPos(this.segmenter_data.curr_file_pos_byte, data, curr_packet_start, curr_packet_end);

                    //Check if random access
                    let is_random_access_point = this.segmenter_data.ts_packet.isRandomAccess(this.segmenter_data.media_info.getVideoPid());
                    if (is_random_access_point)
                        console.log("(" +  this.segmenter_data.media_info.getVideoPid() + ") Random access point (IDR)");

                    //If NOT 1st packet (0 length)
                    if (this.segmenter_data.is_first_packet === false) {

                        //Is next segment needed?
                        let next_segment = false;
                        if (this.segmenter_data.getCurrentChunk().getDuration() >= (this.segmenter_data.config.target_segment_duration_s - this.segmenter_data.config.target_segment_duration_tolerance)) {
                            if (this.segmenter_data.config.break_at_video_idr) {
                                if (is_random_access_point)
                                    next_segment = true;
                            }
                            else {
                                next_segment = true;
                            }
                        }

                        if (next_segment) {
                            this._createNewChunk(this.is_lhls);
                        }

                        //Do not save chunks until media init is set
                        if (this.segmenter_data.media_info.getIsSet() === false) {
                            if (this._getMediaInfoData(this.segmenter_data.config.is_creating_chunks, this.segmenter_data.media_info, this.segmenter_data.ts_packet) === true) {
                                //Set media init data
                                this.chunklist_generator.setMediaIniInfo(this.segmenter_data.media_info);
                            }
                        }
                        else {
                            this.segmenter_data.getCurrentChunk().addTSPacket(this.segmenter_data.ts_packet);
                        }

                        //New packet
                        this.segmenter_data.ts_packet = new tspck.tspacket(this.segmenter_data.packet_size, this.tspckParser, this.tspckPATParser, this.tspckPMTParser);
                        curr_packet_start = sync_index;
                    }

                    this.segmenter_data.is_first_packet = false;

                    //Next sync
                    if ((sync_index + this.segmenter_data.config.packet_expected_length) >= data.length) {
                        this.segmenter_data.bytes_next_sync = sync_index + this.segmenter_data.config.packet_expected_length - data.length;
                        bexit = true;

                        this.segmenter_data.ts_packet.addDataWithPos(this.segmenter_data.curr_file_pos_byte, data, curr_packet_start);
                    }
                    else {
                        sync_index = sync_index + this.segmenter_data.config.packet_expected_length;
                    }
                }
                else {
                    throw new Error("Out of sync!! We need to improve the code to resync");
                }
            }
        }

        this.segmenter_data.curr_file_pos_byte += data.length;
    }
}

//Export class
module.exports.chunklistGenerator = chunklistGenerator;
module.exports.enChunklistType = hlsChunklist.enChunklistType;
