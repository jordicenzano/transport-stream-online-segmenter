
"use strict";

//Allowed live ingest protocols
const enChunklistType = {
    VOD: "vod",
    LIVE_EVENT: "event",
    LIVE_WINDOW: "window"
};

class hls_chunklist {
    constructor(media_file_url) {

        this.chunks_info = null;
        this.media_info = null;

        this.target_duration_s = -1;
        this.media_file_url = media_file_url;
    }

    setChunksInfo(chunks_info) {
        this.chunks_info = chunks_info;

        for (let i = 0; i < this.chunks_info.length; i++) {
            let chunk_info = this.chunks_info[i];

            this.target_duration_s = Math.max(this.target_duration_s, Math.ceil(chunk_info.getDuration()));
        }
    }

    setMediaIniInfo(media_info) {
        this.media_info = media_info;
    }

    toString(type, is_closed) {
        if ((this.chunks_info === null) || (this.media_info === null))
            return null;

        let chunklist_type = enChunklistType.VOD;
        let is_adding_endlist = true;
        if ((typeof (type) === 'string') && (type === enChunklistType.LIVE_EVENT))
            chunklist_type = enChunklistType.LIVE_EVENT;

        if (typeof (is_closed) === 'boolean')
            is_adding_endlist = is_closed;

        let ret = [];

        ret.push('#EXTM3U');
        ret.push('#EXT-X-TARGETDURATION:' + this.target_duration_s.toString());
        ret.push('#EXT-X-VERSION:6');
        ret.push('#EXT-X-MEDIA-SEQUENCE:0');

        if (chunklist_type === enChunklistType.VOD)
            ret.push('#EXT-X-PLAYLIST-TYPE:VOD');
        else  if (chunklist_type === enChunklistType.LIVE_EVENT)
            ret.push('#EXT-X-PLAYLIST-TYPE:EVENT');

        ret.push('#EXT-X-MAP:URI="' + this.media_file_url + '",BYTERANGE="' + (this.media_info.getLastBytePos() - this.media_info.getFirstBytePos()) + '@' + this.media_info.getFirstBytePos() + '"');

        for (let i = 0; i < this.chunks_info.length; i++) {
            let chunk_info = this.chunks_info[i];

            ret.push('#EXTINF:' + chunk_info.getDuration() + ',');
            ret.push('#EXT-X-BYTERANGE:' + (chunk_info.getLastBytePos() - chunk_info.getFirstBytePos()) + '@' + chunk_info.getFirstBytePos());
            ret.push(this.media_file_url);
        }

        if (is_adding_endlist)
            ret.push('#EXT-X-ENDLIST');

        return ret.join('\n');
    }
}

//Export class
module.exports.hls_chunklist = hls_chunklist;
module.exports.enChunklistType = enChunklistType;
