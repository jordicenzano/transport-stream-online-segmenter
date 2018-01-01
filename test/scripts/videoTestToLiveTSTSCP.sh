#!/usr/bin/env bash

if [ "$#" -ne 4 ]
then
  echo "Usage: ./videoTestToLiveTSTSCP.sh VIDEO_BITRATE(Kbps) DURATION(s) ADDR PORT"
  echo "Example: ./videoTestToLiveTSTSCP.sh 1000 5 9000 127.0.0.1"
  exit 1
fi

#Check if ffmpeg is installed
if ! [ -x "$(command -v ffmpeg)" ]; then
  echo 'Error: ffmpeg is not installed.' >&2
  exit 1
fi

VIDEO_BITRATE=$1
DURATION_S=$2
ADDR=$3
PORT=$4

#Select font path based in OS
if [[ "$OSTYPE" == "linux-gnu" ]]; then
    FONT_PATH='/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'
elif [[ "$OSTYPE" == "darwin"* ]]; then
    FONT_PATH='/Library/Fonts/Arial.ttf'
fi

ffmpeg -f lavfi -re -i testsrc=duration=$DURATION_S:size=320x200:rate=30 \
-f lavfi -re -i sine=frequency=1000:duration=$DURATION_S:sample_rate=44100 \
-vf "drawtext=fontfile=$FONT_PATH: text=\'Local time %{localtime\: %Y\/%m\/%d %H.%M.%S} (%{n})\': x=10: y=10: fontsize=16: fontcolor=white: box=1: boxcolor=0x00000099" \
-pix_fmt yuv420p -c:v libx264 -b:v ${VIDEO_BITRATE}k -g 30 -x264opts "keyint=120:min-keyint=120:no-scenecut" -profile:v baseline -preset veryfast \
-c:a libfdk_aac -b:a 96k \
-f mpegts "tcp://$ADDR:$PORT"
