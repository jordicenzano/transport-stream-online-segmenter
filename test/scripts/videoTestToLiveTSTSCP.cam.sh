#!/usr/bin/env bash

if [ "$#" -ne 5 ]
then
  echo "Usage: ./videoTestToLiveTSTSCP.cam.sh VIDEO_BITRATE(Kbps) DURATION(s) PORT ADDR CAM"
  echo "Example: ./videoTestToLiveTSTSCP.cam.sh 1000 5 9000 127.0.0.1 0"
  echo "List Cameras: ffmpeg -f avfoundation -list_devices true -i \"\""
  exit 1
fi

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo 'Error: This command will only run on Mac'
  exit 1
fi

#Check if ffmpeg is installed
if ! [ -x "$(command -v ffmpeg)" ]; then
  echo 'Error: ffmpeg is not installed.' >&2
  exit 1
fi

VIDEO_BITRATE=$1
DURATION_S=$2
PORT=$3
ADDR=$4
CAM=$5

#Select font path based in OS
if [[ "$OSTYPE" == "linux-gnu" ]]; then
    FONT_PATH='/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'
elif [[ "$OSTYPE" == "darwin"* ]]; then
    FONT_PATH='/Library/Fonts/Arial.ttf'
fi

ffmpeg -f avfoundation -pix_fmt uyvy422 -framerate 30 -i "$CAM" \
-vf "drawtext=fontfile=$FONT_PATH: text=\'Local time %{localtime\: %Y\/%m\/%d %H.%M.%S} (%{n})\': x=10: y=10: fontsize=16: fontcolor=white: box=1: boxcolor=0x00000099" \
-pix_fmt yuv420p -c:v libx264 -b:v ${VIDEO_BITRATE}k -g 1 -g 30 -profile:v baseline -preset ultrafast -tune zerolatency \
-c:a libfdk_aac -b:a 96k \
-f mpegts "tcp://$ADDR:$PORT"