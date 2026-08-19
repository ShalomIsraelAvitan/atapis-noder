import React, { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs"; 

export default function CameraDashboard() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [model, setModel] = useState(null);
  const [detections, setDetections] = useState([]);

  useEffect(() => {
    startCamera();
    loadModel();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const loadModel = async () => {
    const loadedModel = await cocoSsd.load();
    setModel(loadedModel);
    console.log("Model loaded");

    setInterval(() => {
      detectFrame();
    }, 200);
  };

  const detectFrame = async () => {
    if (!model || !videoRef.current) return;

    const predictions = await model.detect(videoRef.current);
    setDetections(predictions);

    drawDetections(predictions);
  };

  const drawDetections = (pred) => {
    const ctx = canvasRef.current.getContext("2d");
    const video = videoRef.current;

    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    pred.forEach((item) => {
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        item.bbox[0],
        item.bbox[1],
        item.bbox[2],
        item.bbox[3]
      );

      ctx.fillStyle = "lime";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        `${item.class} (${(item.score * 100).toFixed(1)}%)`,
        item.bbox[0],
        item.bbox[1] > 10 ? item.bbox[1] - 5 : 10
      );
    });
  };

  const countObjects = () => {
    const counts = {};
    detections.forEach((d) => {
      counts[d.class] = (counts[d.class] || 0) + 1;
    });
    return counts;
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📹 Camera Detection Dashboard</h2>

      <div style={styles.dashboard}>
        {/* CAMERA */}
        <div style={styles.cameraContainer}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={styles.video}
          />
          <canvas ref={canvasRef} style={styles.canvas} />
        </div>

        {/* STATS PANEL */}
        <div style={styles.sidePanel}>
          <h3 style={styles.sideTitle}>Detections</h3>
          <ul>
            {Object.entries(countObjects()).map(([obj, count]) => (
              <li key={obj} style={styles.listItem}>
                {obj}: <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: 20 },
  title: { fontSize: 26, marginBottom: 20 },
  dashboard: { display: "flex", gap: 20 },
  cameraContainer: { position: "relative" },
  video: { width: 700, borderRadius: 10 },
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  sidePanel: {
    width: 250,
    padding: 20,
    background: "#f4f4f4",
    borderRadius: 10,
    height: "fit-content",
  },
  sideTitle: { marginBottom: 10 },
  listItem: { marginBottom: 6, fontSize: 16 },
};
