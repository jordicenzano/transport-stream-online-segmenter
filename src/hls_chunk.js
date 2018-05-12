
const fs = require('fs');
const path = require('path');
const tspck = require('./tspacket.js');

"use strict";

const GHOST_PREFIX_DEFAULT = ".growing_";
const FILE_NUMBER_LENGTH_DEFAULT = 5;
const FILE_CHUNK_EXTENSION_DEFAULT = ".ts";

Number.prototype.pad = function(size) {
    let s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
};

class hls_chunk {

    constructor(index, options) {

        this.index = index;

        this.num_packets = 0;

        this.first_byte_pos = -1;
        this.last_byte_pos = -1;

        this.first_pcr = -1;
        this.last_pcr = -1;
        this.duration_s = -1;
        this.estimated_duration_s = -1;

        this.is_writing_chunks = false;

        let is_creating_chunk_in_advance = false;

        if ((options != null) && (typeof (options) === 'object')) {
            this.is_writing_chunks = true;

            //If we are passing estimated duration, let's create the chunk file in advance (probably LHLS)
            if (("estimated_duration_s" in options) && (typeof (options.estimated_duration_s) === 'number')){
                this.estimated_duration_s = options.estimated_duration_s;
                is_creating_chunk_in_advance = true
            }

            let ghost_prefix = GHOST_PREFIX_DEFAULT;
            if (("ghost_prefix" in options) && (typeof(options.ghost_prefix) === 'string'))
                ghost_prefix = options.ghost_prefix;

            let file_number_length = FILE_NUMBER_LENGTH_DEFAULT;
            if (("file_number_length" in options) && (typeof(options.file_number_length) === 'number'))
                file_number_length = options.file_number_length;

            let file_extension = FILE_CHUNK_EXTENSION_DEFAULT;
            if (("file_extension" in options) && (typeof(options.file_extension) === 'string'))
                file_extension = options.file_extension;

            this.filename = this._createFilename(options.base_path, options.chunk_base_file_name, index, file_number_length, file_extension);
            this.filename_ghost = this._createFilename(options.base_path, options.chunk_base_file_name, index, file_number_length, file_extension, ghost_prefix);

            //Create ghost file indicating is growing
            fs.writeFileSync(this.filename_ghost, "");

            if (is_creating_chunk_in_advance) {
                this.curr_stream = fs.createWriteStream(this.filename);
            }

            //Create growing file
            this.curr_stream = null;
        }
    }

    close() {
        if (this.is_writing_chunks === true) {
            if (this.curr_stream != null) {
                this.curr_stream.end();
                this.curr_stream = null;
            }

            if (this.filename_ghost != null) {
                if (fs.existsSync(this.filename_ghost))
                    fs.unlinkSync(this.filename_ghost);
            }

        }
    }

    addTSPacket(ts_packet) {
        this.addTSPacketInfo(ts_packet.getInfo());

        if (this.is_writing_chunks === true) {
            if (this.curr_stream === null) {
                //Create growing file
                this.curr_stream = fs.createWriteStream(this.filename);
            }

            this.curr_stream.write(ts_packet.getBuffer());
        }
    }

    addTSPacketInfo(ts_packet_info) {
        this.num_packets++;

        if (this.first_byte_pos < 0)
            this.first_byte_pos = ts_packet_info.first_byte_pos;
        else
            this.first_byte_pos = Math.min(this.first_byte_pos, ts_packet_info.first_byte_pos);

        this.last_byte_pos = Math.max(this.last_byte_pos, ts_packet_info.last_byte_pos);

        if (ts_packet_info.pcr >= 0) {
            if (this.first_pcr < 0)
                this.first_pcr = ts_packet_info.pcr;
            else
                this.first_pcr = Math.min(this.first_pcr, ts_packet_info.pcr);

            this.last_pcr = Math.max(this.last_pcr, ts_packet_info.pcr);
        }

        if ((this.first_pcr > 0) && (this.last_pcr > 0)) {
            if (this.last_pcr >= this.first_pcr) {
                this.duration_s = Math.max(0, this.last_pcr - this.first_pcr);
            }
            else {
                //Detected possible PCR roll over
                console.log("Possible PCR rollover! first_pcr_current_segment: " + this.first_pcr + ". last_pcr_current_segment: " + this.last_pcr);
                this.duration_s = Math.max(0, tspck.tspacket.getMaxPcr() - this.last_pcr + this.first_pcr);
            }
        }
    }

    getIndex() {
        return this.index;
    }

    getNumTSPackets() {
        return this.num_packets;
    }

    getFirstBytePos() {
        return this.first_byte_pos;
    }

    getLastBytePos() {
        return this.last_byte_pos;
    }

    getEstimatedDuration() {
       return this.estimated_duration_s;
    }

    getDuration() {
        return this.duration_s;
    }

    getFileName() {
        return this.filename;
    }

    getFileNameGhost() {
        return this.filename_ghost;
    }

    _createFilename(base_path, chunk_base_file_name, index, file_number_length, file_extension, ghost_prefix) {
        let ret = "";

        if (typeof (ghost_prefix) === 'string')
            ret = path.join(base_path, ghost_prefix + chunk_base_file_name + index.pad(file_number_length) + file_extension);
        else
            ret = path.join(base_path, chunk_base_file_name + index.pad(file_number_length) + file_extension);

        return ret;
    }
}

//Export class
module.exports.hls_chunk = hls_chunk;
