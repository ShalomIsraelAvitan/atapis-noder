import sys
import os
import time
import json
import argparse
import cv2
from analysis import analyze_frame


def main():
    parser = argparse.ArgumentParser(description='Run analyze_frame on a video file')
    parser.add_argument('video', help='Path to video file or integer camera index (0)')
    parser.add_argument('--out', help='Output annotated video path', default='annotated_out.mp4')
    parser.add_argument('--jsonl', help='Output JSONL path', default='test_output.jsonl')
    parser.add_argument('--display', action='store_true', help='Show annotated frames in a window')
    parser.add_argument('--max-frames', type=int, default=0, help='Max frames to process (0 = all)')
    args = parser.parse_args()

    vid_src = args.video
    # allow camera index
    try:
        cam_idx = int(vid_src)
        cap = cv2.VideoCapture(cam_idx)
    except Exception:
        if not os.path.exists(vid_src):
            print(f'Video file not found: {vid_src}')
            return
        cap = cv2.VideoCapture(vid_src)

    if not cap.isOpened():
        print('Cannot open video source')
        return

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out = cv2.VideoWriter(args.out, fourcc, fps, (width, height))

    jsonl_f = open(args.jsonl, 'w', encoding='utf-8')

    frame_idx = 0
    start = time.time()
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            annotated_frame, status = analyze_frame(frame)

            # write annotated frame
            out.write(annotated_frame)

            # write JSON line with basic metadata
            entry = {
                'frame': frame_idx,
                'time': time.time(),
                'status': status
            }
            jsonl_f.write(json.dumps(entry, default=str) + '\n')

            if args.display:
                cv2.imshow('annotated', annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

            frame_idx += 1
            if args.max_frames and frame_idx >= args.max_frames:
                break

    finally:
        cap.release()
        out.release()
        jsonl_f.close()
        if args.display:
            cv2.destroyAllWindows()

    elapsed = time.time() - start
    print(f'Processed {frame_idx} frames in {elapsed:.2f}s ({frame_idx/elapsed:.2f} fps)')


if __name__ == '__main__':
    main()
