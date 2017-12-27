# transport-stream-online-segmenter

This is a tool that allows you to create an HLS chunklist from any transport stream file.
All the process is done inside the browser, so the TS files are NOT uploaded anywhere making segmentation process fast and secure.
Taking advantage of HLS v6 we can generate a byte range HLS chunklist that prevents you to modify / split your TS file

# Usage in the browser

* Click here [online-segmenter](https://jordicenzano.github.io/transport-stream-online-segmenter/)
* Select the desired target duration and select a .ts file from your local computer (*)
* Copy the resulting chunklist data in a file in the *same directory* where your .ts file is, for example `chunklist.m3u8`
* Use any HLS player to play the resulting manifest file `chunklist.m3u8`. For instance: [VLC](https://www.videolan.org/vlc/index.html), `Quicktime` or `Safari`
* (optional) is more "fun" if you put a webserver in front of those files. For instance [node-static](https://github.com/cloudhead/node-static)

# Usage in the console

* Use the following syntax(*):
```
./transport-stream-segmenter-cli.js /your_path/input.ts /your_path/chunklist.m3u8
```
You can execute `./transport-stream-segmenter-cli.js` (without arguments) to get help about accepted parameters

#TODO
* Add option to read from URL (very easy)

(*) If you do not have any ts file you can generate one by using `ffmpeg`:
```
ffmpeg -f lavfi -re -i testsrc=duration=10:size=320x200:rate=30 \
-f lavfi -re -i sine=frequency=1000:duration=10:sample_rate=44100 \
-pix_fmt yuv420p -c:v libx264 -b:v 1000k -g 30 -x264opts "keyint=120:min-keyint=120:no-scenecut" -profile:v baseline -preset veryfast \
-c:a libfdk_aac -b:a 96k \
-f mpegts demo.ts
```


