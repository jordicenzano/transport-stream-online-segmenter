const path = require('path');

"use strict";

//Allowed live ingest protocols
const enChunklistType = {
    VOD: "vod",
    LIVE_EVENT: "event",
    LIVE_WINDOW: "window"
};

const DEFAULT_LIVE_WINDOW_SIZE = 3;

class hls_chunklist {
    constructor(chunklist_type, media_file_url, options) {

        this.chunks = [];
        this.media_info = null;

        this.target_duration_s = -1;
        this.media_sequence = 0;
        this.media_file_url = media_file_url;
        this.is_splitting_chunks = false;
        this.is_using_relative_path = false;
        this.is_lhls = false;

        this.chunklist_type = chunklist_type;
        this.live_window_size = DEFAULT_LIVE_WINDOW_SIZE;

        if (typeof (options) === 'object') {
            if (options.is_splitting_chunks === true)
                this.is_splitting_chunks = true;

            if (options.is_using_relative_path === true)
                this.is_using_relative_path = true;

            if (typeof(options.live_window_size) === 'number')
                this.live_window_size = options.live_window_size;

            if (options.is_lhls === true)
                this.is_lhls = true;
        }
    }

    addChunk(chunk) {
        this.chunks.push(chunk);

        if (this.chunklist_type === enChunklistType.LIVE_WINDOW) {
            while (this.chunks.length > this.live_window_size) {
                let removed_chunk = this.chunks.shift();

                this.media_sequence++;

                console.log("Removed chunk index " + removed_chunk.getIndex() + " from the chunklist");
            }
        }
    }

    setMediaIniInfo(media_info) {
        this.media_info = media_info;
    }

    toString(is_closed) {
        if ((this.chunks === null) || (this.media_info === null) || (this.media_info.getIsSet() === false))
            return null;

        let ret = [];

        this.target_duration_s = this._calcTargetDuration();

        ret.push('#EXTM3U');
        ret.push('#EXT-X-TARGETDURATION:' + this.target_duration_s.toString());
        ret.push('#EXT-X-VERSION:6');
        ret.push('#EXT-X-MEDIA-SEQUENCE:' + this.media_sequence);

        if (this.chunklist_type === enChunklistType.VOD)
            ret.push('#EXT-X-PLAYLIST-TYPE:VOD');
        else  if (this.chunklist_type === enChunklistType.LIVE_EVENT)
            ret.push('#EXT-X-PLAYLIST-TYPE:EVENT');

        if (this.is_splitting_chunks === false) {
            ret.push('#EXT-X-MAP:URI="' + this.media_file_url + '",BYTERANGE="' + (this.media_info.getLastBytePos() - this.media_info.getFirstBytePos()) + '@' + this.media_info.getFirstBytePos() + '"');
        }
        else {
            let fileName = this.media_info.getFileName();

            if (this.is_using_relative_path)
                fileName = path.basename(fileName);

            ret.push('#EXT-X-MAP:URI="' + fileName + '"');
        }

        for (let i = 0; i < this.chunks.length; i++) {
            let chunk = this.chunks[i];
            let chunk_dur_s =  chunk.getDuration();
            if (this.is_lhls)
                chunk_dur_s = chunk.getEstimatedDuration();

            ret.push('#EXTINF:' + chunk_dur_s + ',');
            if (this.is_splitting_chunks === false) {
                ret.push('#EXT-X-BYTERANGE:' + (chunk.getLastBytePos() - chunk.getFirstBytePos()) + '@' + chunk.getFirstBytePos());
                ret.push(this.media_file_url);
            }
            else {
                if (this.is_using_relative_path)
                    ret.push(path.basename(chunk.getFileName()));
                else
                    ret.push(chunk.getFileName());
            }
        }

        if (is_closed === true)
            ret.push('#EXT-X-ENDLIST');

        return ret.join('\n');
    }

    _calcTargetDuration() {
        let ret = 0;

        for (let i = 0; i < this.chunks.length; i++) {
            let chunk = this.chunks[i];
            let chunk_dur = chunk.getDuration();
            if (this.is_lhls)
                chunk_dur = chunk.getEstimatedDuration();

            ret = Math.max(ret, Math.ceil(chunk_dur));
        }

        return ret;
    }
}

//Export class
module.exports.hls_chunklist = hls_chunklist;
module.exports.enChunklistType = enChunklistType;
