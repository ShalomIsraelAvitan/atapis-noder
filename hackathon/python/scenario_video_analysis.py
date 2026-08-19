import argparse
import json
import os
import shutil
import subprocess
from collections import Counter
from datetime import datetime

import cv2

from analysis import analyze_frame


MODE_RISK_FLOOR = {
    "SAFE": 0,
    "ALERT": 40,
    "DANGER": 75,
}

DEFAULT_FRAME_SKIP = 2
DEFAULT_MAX_WIDTH = 960
PROGRESS_WRITE_INTERVAL_FRAMES = 10


def _most_common(counter, fallback="Unknown"):
    if not counter:
        return fallback
    return counter.most_common(1)[0][0]


def _write_progress(progress_path, payload):
    if not progress_path:
        return

    temp_path = f"{progress_path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as progress_file:
        json.dump(payload, progress_file, indent=2)
    os.replace(temp_path, progress_path)


def _transcode_to_browser_format(source_path, target_path):
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise RuntimeError(
            "Scenario analysis completed, but ffmpeg was not found for browser-compatible video export. "
            "Install ffmpeg or add it to PATH."
        )

    temp_target = f"{target_path}.tmp.mp4"
    command = [
        ffmpeg_path,
        "-y",
        "-i",
        source_path,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        temp_target,
    ]
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        if os.path.exists(temp_target):
            try:
                os.remove(temp_target)
            except OSError:
                pass
        error_output = (completed.stderr or completed.stdout or "ffmpeg transcoding failed").strip()
        raise RuntimeError(f"Scenario analysis video was created, but browser transcoding failed: {error_output}")

    os.replace(temp_target, target_path)


def _build_summary(source_path, output_path, processed_frames, total_frames, final_mode, max_risk,
                   person_count_max, has_weapon, motion_counter, context_counter):
    return {
        "source_filename": os.path.basename(source_path),
        "output_filename": os.path.basename(output_path),
        "analyzed_at": datetime.now().isoformat(),
        "frames_processed": processed_frames,
        "total_frames": total_frames,
        "final_mode": final_mode,
        "max_risk": int(round(max_risk)),
        "person_count_max": int(person_count_max),
        "has_weapon": bool(has_weapon),
        "main_motion": _most_common(motion_counter),
        "main_context": _most_common(context_counter),
    }


def main():
    parser = argparse.ArgumentParser(description="Run scenario video analysis with analyze_frame().")
    parser.add_argument("video", help="Path to the uploaded input video.")
    parser.add_argument("--output", required=True, help="Path to the annotated output video.")
    parser.add_argument("--summary", required=True, help="Path to the JSON summary file.")
    parser.add_argument("--progress", help="Path to a JSON progress file.")
    parser.add_argument("--frame-skip", type=int, default=DEFAULT_FRAME_SKIP, help="Analyze every Nth frame.")
    parser.add_argument("--max-width", type=int, default=DEFAULT_MAX_WIDTH, help="Resize frames to this width before inference.")
    args = parser.parse_args()

    if not os.path.exists(args.video):
        raise RuntimeError(f"Uploaded video was not found: {args.video}")

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise RuntimeError("The uploaded video could not be opened. Please upload a valid MP4, AVI, or MOV file.")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    if fps <= 0:
        fps = 25.0

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    if width <= 0 or height <= 0:
        cap.release()
        raise RuntimeError("The uploaded video has invalid dimensions and could not be processed.")

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    os.makedirs(os.path.dirname(args.summary), exist_ok=True)

    frame_skip = max(1, int(args.frame_skip or DEFAULT_FRAME_SKIP))
    max_width = max(0, int(args.max_width or DEFAULT_MAX_WIDTH))
    resize_scale = 1.0
    output_width = width
    output_height = height

    if max_width and width > max_width:
        resize_scale = max_width / float(width)
        output_width = int(round(width * resize_scale))
        output_height = int(round(height * resize_scale))

    _write_progress(
        args.progress,
        {
            "status": "processing",
            "stage": "Preparing video",
            "progress_percent": 0,
            "frames_total": total_frames,
            "frames_read": 0,
            "frames_analyzed": 0,
            "frame_skip": frame_skip,
            "output_width": output_width,
            "output_height": output_height,
        },
    )

    raw_output_path = f"{args.output}.raw.mp4"

    writer = cv2.VideoWriter(
        raw_output_path,
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (output_width, output_height),
    )
    if not writer.isOpened():
        cap.release()
        raise RuntimeError("The output video file could not be created.")

    processed_frames = 0
    analyzed_frames = 0
    frames_read = 0
    final_mode = "SAFE"
    max_risk = 0.0
    person_count_max = 0
    has_weapon = False
    motion_counter = Counter()
    context_counter = Counter()
    last_output_frame = None

    captured_error = None

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frames_read += 1

            if resize_scale != 1.0:
                frame = cv2.resize(frame, (output_width, output_height), interpolation=cv2.INTER_AREA)

            should_analyze = last_output_frame is None or ((frames_read - 1) % frame_skip == 0)
            if should_analyze:
                annotated_frame, status = analyze_frame(frame)
                last_output_frame = annotated_frame
                tracks = status.get("tracks", [])

                final_mode = status.get("mode", final_mode)
                frame_risk_values = [
                    float(status.get("fused_risk", 0.0) or 0.0),
                    float(status.get("max_risk", 0.0) or 0.0),
                    *[float(track.get("risk", 0.0)) for track in tracks],
                ]
                frame_risk = max(frame_risk_values or [MODE_RISK_FLOOR.get(final_mode, 0)])
                max_risk = max(max_risk, frame_risk)

                person_count = int(status.get("person_count") or len(status.get("person_boxes", [])) or 0)
                person_count_max = max(person_count_max, person_count)
                track_has_weapon = any(bool(track.get("has_weapon")) for track in tracks)
                has_weapon = has_weapon or track_has_weapon or (not tracks and bool(status.get("has_weapon")))

                motion = status.get("motion")
                if motion:
                    motion_counter[motion] += 1

                context = status.get("context")
                if context:
                    context_counter[context] += 1

                analyzed_frames += 1

            writer.write(last_output_frame if last_output_frame is not None else frame)
            processed_frames += 1

            if total_frames > 0 and (
                frames_read == total_frames
                or frames_read == 1
                or frames_read % PROGRESS_WRITE_INTERVAL_FRAMES == 0
            ):
                progress_percent = min(97, int(round((frames_read / total_frames) * 100)))
                _write_progress(
                    args.progress,
                    {
                        "status": "processing",
                        "stage": "Analyzing video",
                        "progress_percent": progress_percent,
                        "frames_total": total_frames,
                        "frames_read": frames_read,
                        "frames_analyzed": analyzed_frames,
                        "frame_skip": frame_skip,
                        "output_width": output_width,
                        "output_height": output_height,
                    },
                )

        if processed_frames == 0:
            raise RuntimeError("The uploaded video did not contain readable frames.")

        summary = _build_summary(
            args.video,
            args.output,
            analyzed_frames,
            total_frames,
            final_mode,
            max_risk,
            person_count_max,
            has_weapon,
            motion_counter,
            context_counter,
        )

        with open(args.summary, "w", encoding="utf-8") as summary_file:
            json.dump(summary, summary_file, indent=2)
    except Exception as exc:
        captured_error = exc
    finally:
        cap.release()
        writer.release()

    if captured_error is not None:
        if os.path.exists(args.output):
            try:
                os.remove(args.output)
            except OSError:
                pass
        if os.path.exists(raw_output_path):
            try:
                os.remove(raw_output_path)
            except OSError:
                pass
        if os.path.exists(args.summary):
            try:
                os.remove(args.summary)
            except OSError:
                pass
        if args.progress:
            try:
                os.remove(args.progress)
            except OSError:
                pass
        raise captured_error

    _write_progress(
        args.progress,
        {
            "status": "processing",
            "stage": "Encoding final video",
            "progress_percent": 98,
            "frames_total": total_frames,
            "frames_read": frames_read,
            "frames_analyzed": analyzed_frames,
            "frame_skip": frame_skip,
            "output_width": output_width,
            "output_height": output_height,
        },
    )
    _transcode_to_browser_format(raw_output_path, args.output)
    if os.path.exists(raw_output_path):
        try:
            os.remove(raw_output_path)
        except OSError:
            pass

    _write_progress(
        args.progress,
        {
            "status": "completed",
            "stage": "Completed",
            "progress_percent": 100,
            "frames_total": total_frames,
            "frames_read": frames_read,
            "frames_analyzed": analyzed_frames,
            "frame_skip": frame_skip,
            "output_width": output_width,
            "output_height": output_height,
        },
    )


if __name__ == "__main__":
    main()
