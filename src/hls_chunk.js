const tspck = require('./tspacket.js');

"use strict";

class hls_chunk {
    constructor(index) {

        this.index = index;

        this.num_packets = 0;

        this.first_byte_pos = -1;
        this.last_byte_pos = -1;

        this.first_pcr = -1;
        this.last_pcr = -1;
        this.duration_s = 0;
    }

    addTSPacket(ts_packet) {
        this.addTSPacketInfo(ts_packet.getInfo());
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

    getDuration() {
        return this.duration_s;
    }
}

//Export class
module.exports.hls_chunk = hls_chunk;
