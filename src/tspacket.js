//Jordi Cenzano 2017

"use strict";

const TS_DEFAULT_PACKET_SIZE = 188;

const MAX_PCR_VALUE = 95443; //2^33 / 90000 (33 bits used by pcr with timebase of 90KHz)

// Constructor
class tspacket {

    constructor(packet_size, ts_packet_parser, ts_pat_packet_parser, ts_pmt_packet_parser) {

        this.packet_size = TS_DEFAULT_PACKET_SIZE;
        if (typeof (packet_size) === 'number')
            this.packet_size = packet_size;

        this.ts_packet_data = [];
        this.ts_packet_data_size = 0;

        this.ts_packet_buffer = null;

        this.packet_structure = null;

        //PAT parse
        this.packet_pat_structure = null;
        //PMT parse
        this.packet_pmt_structure = null;

        this.first_byte_pos = -1;
        this.last_byte_pos = -1;

        this.ts_packet_parser = ts_packet_parser;
        this.ts_pat_packet_parser = ts_pat_packet_parser;
        this.ts_pmt_packet_parser = ts_pmt_packet_parser;
    }

    addDataWithPos(first_bit_pos, buff, start, end, force_copy) {

        let start_internal = 0;
        if (typeof (start) === 'number')
            start_internal = start;

        let end_internal = buff.length;
        if (typeof (end) === 'number')
            end_internal = end;

        if (this.first_byte_pos < 0)
            this.first_byte_pos = first_bit_pos + start_internal;
        else
            this.first_byte_pos = Math.min(first_bit_pos + start_internal, this.first_byte_pos);

        this.last_byte_pos = Math.max(first_bit_pos + end_internal, this.last_byte_pos);

        return this.addData(buff, start, end, force_copy);
    }

    getFirstBytePos() {
        return this.first_byte_pos;
    }

    getLastBytePos() {
        return this.last_byte_pos;
    }

    addData(buff, start, end, force_copy) {
        let buff_start = 0;
        if (typeof (start) !== 'undefined')
            buff_start = start;

        let buff_end = buff.length;
        if (typeof (end) !== 'undefined')
            buff_end = end;

        let buff_force_copy = false;
        if ((typeof (force_copy) === 'boolean') && (force_copy === true))
            buff_force_copy = true;

        let buff_lenght = buff_end - buff_start;

        if (buff_lenght < 0)
            throw new Error("0 bytes can not be added to segment");

        if (buff_lenght > 0) {
            let new_buffer = null;
            if ((buff_start !== 0) || (buff_end !== buff.length)) {
                if (buff_force_copy === false){
                    new_buffer = Buffer.from(buff.buffer, start, buff_lenght);
                }
                else {
                    let tmp_buffer = Buffer.copy(buff.buffer, start, buff_lenght);

                    new_buffer = Buffer.from(tmp_buffer);
                }
            }
            else if (buff_lenght > 0) {
                if (buff_force_copy === false)
                    new_buffer = buff;
                else
                    new_buffer = Buffer.from(buff);
            }

            if (new_buffer !== null) {
                this.ts_packet_data.push(new_buffer);
                this.ts_packet_data_size += buff_lenght;
            }
        }
    }

    getFirstBytePos() {
        return this.first_byte_pos;
    }

    getLastBytePos() {
        return this.last_byte_pos;
    }

    getPcr() {
        let ret_ms = -1;

        this._parse();

        if (this.packet_structure !== null) {
            if (("adaptationField" in this.packet_structure) && ("PCRField" in this.packet_structure.adaptationField)) {
                if (this.packet_structure.adaptationField.AdaptationFieldLength >= 7 ) {
                    let encoded_pcr = this.packet_structure.adaptationField.PCRField;

                    if (("Base32" in encoded_pcr) && ("Base33" in encoded_pcr) && ("Extension" in encoded_pcr)) {
                        //console.log(encoded_pcr);

                        let base32 = encoded_pcr.Base32;
                        let base33 = encoded_pcr.Base33;

                        //Bitwise operators in javascript only works for < 32b numbers
                        // (base32 << 1) | (base33 & 0x1);
                        let pcr_base = (base32 * 2) + (base33 & 0x1);
                        if (encoded_pcr.Extension > 0) {
                            //Use extension
                            let pcr = (pcr_base * 300 + encoded_pcr.Extension);
                            ret_ms =  pcr / (27 * 1000000);

                            console.log("PCR extension: " + encoded_pcr + ". Clk (27MHz): " + pcr + ". Time(ms): " + ret_ms);
                        }
                        else {
                            ret_ms =  pcr_base / 90000;
                        }
                    }
                }
            }
        }

        return ret_ms;
    }

    isPAT() {
        let ret = false;

        this._parse();

        if (this.packet_structure !== null) {
            if (("pid" in this.packet_structure) && (this.packet_structure.pid === 0))
                ret = true;
        }

        return ret;
    }

    isID(id) {
        let ret = false;

        this._parse();

        if (this.packet_structure !== null) {
            if (("pid" in this.packet_structure) && (this.packet_structure.pid === id))
                ret = true;
        }

        return ret;
    }

    getESInfo() {
        let ret = null;

        this._parsePMT();

        if (this.packet_pmt_structure !== null) {
            if (("payload" in this.packet_pmt_structure) && ("elementaryStreamsInfo" in this.packet_pmt_structure.payload))
                ret = this.packet_pmt_structure.payload.elementaryStreamsInfo;
        }

        return ret;
    }

    getPMTsIDs() {
        let ret = null;

        if (this.isPAT()) {
            this._parsePAT();

            if (this.packet_pat_structure !== null) {
                if (("payload" in this.packet_pat_structure) && ("pmtsData" in this.packet_pat_structure.payload))
                    ret = this.packet_pat_structure.payload.pmtsData;
            }
        }

        return ret;
    }

    isRandomAccess(pid) {
        let ret = false;

        this._parse();

        if (this.packet_structure !== null) {
            if (("adaptationField" in this.packet_structure) && ("PCRField" in this.packet_structure.adaptationField)) {
                if (this.packet_structure.adaptationField.AdaptationFieldLength >= 1) {
                    if ((this.packet_structure.adaptationField.RandomAccessIndicator > 0) && (this.packet_structure.pid === pid))
                        ret = true;
                }
            }
        }

        return ret;
    }

    getBuffer() {
        if (this.ts_packet_buffer === null) {
            if (this.ts_packet_data.length > 1) {
                //console.log("Number of buffer to concat: " + this.ts_packet_data.length);
                this.ts_packet_buffer = Buffer.concat(this.ts_packet_data);
            }
            else if (this.ts_packet_data.length === 1) {
                this.ts_packet_buffer = this.ts_packet_data[0];
            }
        }

        return this.ts_packet_buffer;
    }

    getInfo() {
        return {
            first_byte_pos: this.getFirstBytePos(),
            last_byte_pos: this.getLastBytePos(),
            pcr: this.getPcr()
        }
    }

    clone() {
        let ret = new tspacket(this.packet_size, this.ts_packet_parser);

        let buff_src = this.getBuffer();
        ret.addData(buff_src, 0, buff_src.length, true);

        return ret;
    }

    _parse() {
        //Only process complete packets (just in case)
        if ((this.ts_packet_data_size >= this.packet_size) && (this.packet_structure === null)) {
            this.getBuffer();

            this.packet_structure = this.ts_packet_parser.parse(this.ts_packet_buffer);
        }
    }

    _parsePAT() {
        //Only process complete packets (just in case)
        if ((this.ts_packet_data_size >= this.packet_size) && (this.packet_pat_structure === null)) {
            this.getBuffer();

            this.packet_pat_structure = this.ts_pat_packet_parser.parse(this.ts_packet_buffer);
        }
    }

    _parsePMT() {
        //Only process complete packets (just in case)
        if ((this.ts_packet_data_size >= this.packet_size) && (this.packet_pmt_structure === null)) {
            this.getBuffer();

            this.packet_pmt_structure = this.ts_pmt_packet_parser.parse(this.ts_packet_buffer);
        }
    }

    static getMaxPcr() {
        return MAX_PCR_VALUE;
    }

    //According to ISO/IEC 13818-1:2007 (E)
    static isStreamTypeVideo(stream_type) {
        let ret = false;

        if (stream_type === 0x01)
            ret = true; //ISO/IEC 11172-2 Video

        if (stream_type === 0x02)
            ret = true; //ITU-T Rec. H.262 | ISO/IEC 13818-2 Video or ISO/IEC 11172-2 constrained parameter video stream

        if (stream_type === 0x1B)
            ret = true; //AVC video stream as defined in ITU-T Rec. H.264 | ISO/IEC 14496-10 Video

        return ret;
    }

}

//Export class
module.exports.tspacket = tspacket;
