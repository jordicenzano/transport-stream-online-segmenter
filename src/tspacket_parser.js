//Jordi Cenzano 2017
const binparser = require('binary-parser').Parser;

"use strict";

// Constructor
class tspacketParser {

    constructor() {

        //TODO: A lot of repeated code, it can be optimized

        //Utils
        this.stop_parse = new binparser();

        this.skip_0 = new binparser()
            .endianess('big')
            .skip(function() { return 0 });

        //PCR
        this.ts_packet_adaptation_field_pcrs = new binparser()
            .endianess('big')
            .uint32('Base32')
            .bit1('Base33')
            .bit6('Reserved')
            .bit9('Extension');

        //Adaptation field
        this.ts_packet_adaptation_field = new binparser()
            .endianess('big')
            .uint8('AdaptationFieldLength')
            .bit1('DiscontinuityIndicator')
            .bit1('RandomAccessIndicator')
            .bit1('ElementaryStreamPriorityIndicator')
            .bit1('PCRFlag')
            .bit1('OPCRFlag')
            .bit1('SplicingPointFlag')
            .bit1('TransportPrivateDataFlag')
            .bit1('AdaptationFieldExtensionFlag')
            .choice('PCRField', {
                tag: 'PCRFlag',
                defaultChoice: this.stop_parse,
                choices: {
                    1: this.ts_packet_adaptation_field_pcrs
                }
            });

        //General TS packet
        this.ts_packet_parser = new binparser()
            .endianess('big')
            .uint8('syncByte')
            .bit1('transportErrorIndicator')
            .bit1('payloadUnitStartIndicator')
            .bit1('transportPriority')
            .bit13('pid')
            .bit2('transportScramblingControl')
            .bit2('adaptationFieldControl')
            .bit4('continuityCounter')
            .choice('adaptationField', {
                tag: 'adaptationFieldControl',
                defaultChoice: this.stop_parse,
                choices: {
                    2: this.ts_packet_adaptation_field,
                    3: this.ts_packet_adaptation_field
                }
            });

        //PAT table component
        this.ts_packet_payload_table_pat_component = new binparser()
            .endianess('big')
            .uint16('programNumber')
            .bit3('reservedBits')
            .bit13('pmtID');

        //PAT table
        this.ts_packet_payload_table_pat = new binparser()
            .endianess('big')
            .uint8('tableID')
            .bit1('sectionSyntaxIndicator')
            .bit1('privateBit')
            .bit2('reservedBits1')
            .bit2('unusedBits')
            .bit10('sectionLength')
            .uint16('tableIDExtension')
            .bit2('reservedBits2')
            .bit5('versionNum')
            .bit1('currentNext')
            .uint8('sectionNumber')
            .uint8('lastSectionNumber')
            .array('pmtsData', {
                type: this.ts_packet_payload_table_pat_component,
                length: function() { return (this.sectionLength - (5 + 4)) / 4; }
            })
            .uint32('CRC');

        //Pointer before payload
        this.ts_packet_pointer = new binparser()
            .endianess('big')
            .uint8('length')
            .skip(function() { return this.length });

        //PAT packet
        this.ts_packet_PAT_parser = new binparser()
            .endianess('big')
            .uint8('syncByte')
            .bit1('transportErrorIndicator')
            .bit1('payloadUnitStartIndicator')
            .bit1('transportPriority')
            .bit13('pid', { assert: 0 })
            .bit2('transportScramblingControl')
            .bit2('adaptationFieldControl')
            .bit4('continuityCounter')
            .choice('adaptationField', {
                tag: 'adaptationFieldControl',
                defaultChoice: this.stop_parse,
                choices: {
                    1: this.skip_0,
                    2: this.ts_packet_adaptation_field,
                    3: this.ts_packet_adaptation_field
                }
            })
            .choice('pointer', {
                tag: 'payloadUnitStartIndicator',
                defaultChoice: this.stop_parse,
                choices: {
                    0: this.skip_0,
                    1: this.ts_packet_pointer
                }
            })
            .choice('payload', {
                tag: 'adaptationFieldControl',
                defaultChoice: this.stop_parse,
                choices: {
                    1: this.ts_packet_payload_table_pat,
                    3: this.ts_packet_payload_table_pat
                }
            });

        //PMT table ES component
        this.ts_packet_payload_table_pmt_es_component = new binparser()
            .endianess('big')
            .uint8('streamType')
            .bit3('reservedBits')
            .bit13('elementaryPID')
            .bit4('reservedBits1')
            .bit2('unusedBits')
            .bit10('elementaryInfoLength')
            .skip(function() { return this.elementaryInfoLength; });

        //PMT table
        this.ts_packet_payload_table_pmt = new binparser()
            .endianess('big')
            .uint8('tableID')
            .bit1('sectionSyntaxIndicator')
            .bit1('privateBit')
            .bit2('reservedBits1')
            .bit2('unusedBits')
            .bit10('sectionLength')
            .uint16('tableIDExtension')
            .bit2('reservedBits2')
            .bit5('versionNum')
            .bit1('currentNext')
            .uint8('sectionNumber')
            .uint8('lastSectionNumber')
            .bit3('reservedBits')
            .bit13('pcrPID')
            .bit4('reservedBits1')
            .bit2('reservedBits2')
            .bit10('programInfoLength')
            .skip(function() { return this.programInfoLength; })
            .array('elementaryStreamsInfo', {
                type: this.ts_packet_payload_table_pmt_es_component,
                lengthInBytes: function() { return (this.sectionLength - (9 + this.programInfoLength + 4)); }
            })
            .uint32('CRC');

        //PMT parser
        this.ts_packet_PMT_parser = new binparser()
            .endianess('big')
            .uint8('syncByte')
            .bit1('transportErrorIndicator')
            .bit1('payloadUnitStartIndicator')
            .bit1('transportPriority')
            .bit13('pid')
            .bit2('transportScramblingControl')
            .bit2('adaptationFieldControl')
            .bit4('continuityCounter')
            .choice('adaptationField', {
                tag: 'adaptationFieldControl',
                defaultChoice: this.stop_parse,
                choices: {
                    1: this.skip_0,
                    2: this.ts_packet_adaptation_field,
                    3: this.ts_packet_adaptation_field
                }
            })
            .choice('pointer', {
                tag: 'payloadUnitStartIndicator',
                defaultChoice: this.stop_parse,
                choices: {
                    0: this.skip_0,
                    1: this.ts_packet_pointer
                }
            })
            .choice('payload', {
                tag: 'adaptationFieldControl',
                defaultChoice: this.stop_parse,
                choices: {
                    1: this.ts_packet_payload_table_pmt,
                    3: this.ts_packet_payload_table_pmt
                }
            });
    }

    getPacketParser() {
        return this.ts_packet_parser;
    }

    getPATPacketParser() {
        return this.ts_packet_PAT_parser;
    }

    getPMTPacketParser() {
        return this.ts_packet_PMT_parser;
    }
}

//Export class
module.exports.tspacketParser = tspacketParser;
