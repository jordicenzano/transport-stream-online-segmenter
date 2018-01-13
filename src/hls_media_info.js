const fs = require('fs');

"use strict";

class hls_media_info {

    constructor() {

        this.ts_packets = [];

        this.filename = null;
        this.is_saved = false;

        this.video_pid = -1;

        this.pat = {
            pmt_id: -1,
            first_byte_pos: -1,
            last_byte_pos: -1
        };

        this.pmt = {
            first_byte_pos: -1,
            last_byte_pos: -1
        };
    }

    setVideoPid(pid) {
        this.video_pid = pid;
    }

    addTSPacket(ts_packet) {
        this.ts_packets.push(ts_packet);
    }

    setPat(pmt_id, first_byte_pos, last_byte_pos) {
        this.pat.pmt_id = pmt_id;
        this.pat.first_byte_pos = first_byte_pos;
        this.pat.last_byte_pos = last_byte_pos;

    }

    getPmtId() {
        return this.pat.pmt_id;
    }

    setPmt(first_byte_pos, last_byte_pos) {
        this.pmt.first_byte_pos = first_byte_pos;
        this.pmt.last_byte_pos = last_byte_pos;
    }

    getVideoPid() {
        return this.video_pid;
    }

    getFirstBytePos() {
        let ret = -1;

        if (this.getIsSet())
            ret = Math.min(this.pat.first_byte_pos, this.pmt.first_byte_pos);

        return ret;
    }

    getLastBytePos() {
        let ret = -1;

        if (this.getIsSet())
            ret = Math.max(this.pat.last_byte_pos, this.pmt.last_byte_pos);

        return ret;
    }

    getIsSet() {
        let ret = false;

        if ((this.video_pid >= 0) && (this.pat.pmt_id >= 0) && (this.pat.first_byte_pos >= 0) && (this.pat.last_byte_pos >= 0) && (this.pmt.first_byte_pos >= 0) && (this.pmt.last_byte_pos >=0))
            ret = true;

        return ret;
    }

    setFileName(filename) {
        this.filename = filename;
    }

    save() {
        if (this.filename != null) {
            if (this.getIsSet()) {
                let fw = fs.createWriteStream(this.filename);

                for (let i = 0; i < this.ts_packets.length; i++) {
                    let ts_packet = this.ts_packets[i];

                    fw.write(ts_packet.getBuffer());
                }

                fw.end();

                this.is_saved = true;
            }
        }
    }

    getFileName() {
        return this.filename;
    }

    getIsSaved() {
        return this.is_saved;
    }
}

//Export class
module.exports.hls_media_info = hls_media_info;
