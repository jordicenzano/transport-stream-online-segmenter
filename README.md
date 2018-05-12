# transport-stream-online-segmenter

This is a tool that allows you to create an HLS chunklist from any transport stream file.
For the online version all the process is done inside the browser, so the input TS file are NOT uploaded anywhere making segmentation process fast and secure.
Taking advantage of HLS v6 we can generate a byte range HLS chunklist that prevents you to modify / split your TS file.

You can also execute the same segmenter in the CLI (nodeJS), and then you can also use it to segment a live TS TCP stream or a local TS file, in that case the chunks can be generated and saved to the local disc.

# Usage in the browser

* Click here [online-segmenter](https://jordicenzano.github.io/transport-stream-online-segmenter/)
* Select the desired target duration and select a .ts file from your local computer (see note 1), or put a URL of any ts file (remember should have a proper CORS policy)
* The .ts file will be processed in YOUR browser and the resulting HLS v6 chunklist displayed

## Testing the results:
* Copy the resulting chunklist data in a file in the *same directory* where your .ts file is, for example `chunklist.m3u8`
* Use any HLS player to play the resulting manifest file `chunklist.m3u8`. For instance: [VLC](https://www.videolan.org/vlc/index.html) or `Safari`
* (optional) is more "fun" if you put a webserver in front of those files. For instance [node-static](https://github.com/cloudhead/node-static)

# Usage in the console to process files

* Use the following syntax, see note 1 or testing:
```
./transport-stream-segmenter-cli.js /your_path/input.ts /your_path/chunklist.m3u8
```
You can execute `./transport-stream-segmenter-cli.js` (without arguments) to get help about accepted parameters

# Usage in the console to process TCP streams (live)

It provides a server TCP socket to ingest a TS TCP stream, and it generates a live EVENT or WINDOW chunklist, it also saves the chunk files indicating them as growing files, useful if you want to implement [LHLS](https://medium.com/@periscopecode/introducing-lhls-media-streaming-eb6212948bef) or reduce latency using chunked transfer. See Note 2 if you want to test it.

* Use the following syntax, see note 2 for testing:
```
./transport-stream-segmenter-tcp.js 9000 /tmp media_ out.m3u8 4 127.0.0.1 event
```
You can execute `./transport-stream-segmenter-tcp.js` (without arguments) to get help about accepted parameters

Note 1: If you do not have any ts file you can generate one by using `ffmpeg`:
```
ffmpeg -f lavfi -re -i testsrc=duration=10:size=320x200:rate=30 \
-f lavfi -re -i sine=frequency=1000:duration=10:sample_rate=44100 \
-pix_fmt yuv420p -c:v libx264 -b:v 1000k -g 30 -x264opts "keyint=120:min-keyint=120:no-scenecut" -profile:v baseline -preset veryfast \
-c:a libfdk_aac -b:a 96k \
-f mpegts demo.ts
```

Note 2: If you do not have any encoder able to generate a TS TCP stream, you can execute the following script included in this repo (it uses `ffmpeg` behind the scenes):
```
./test/scripts/videoTestToLiveTSTSCP.sh 1000 120 9000 127.0.0.1
```

