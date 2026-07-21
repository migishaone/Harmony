import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

interface HandDetectionResult {
  pointerPosition: { x: number; y: number } | null;
  openness: number; // 0-100 percentage
  detected: boolean;
  fingerCount: number;
  isPointing: boolean;
  handedness: 'Left' | 'Right' | null;
  isReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hands: Partial<Record<'Left' | 'Right', TrackedHand>>;
}

export interface TrackedHand {
  pointerPosition: { x: number; y: number } | null;
  openness: number;
  fingerCount: number;
  isPointing: boolean;
  handedness: 'Left' | 'Right';
}

const DETECTION_INTERVAL_MS = 1000 / 30;

export function useHandDetection(enabled = true): HandDetectionResult {
  const [isReady, setIsReady] = useState(false);
  const [detected, setDetected] = useState(false);
  const [fingerCount, setFingerCount] = useState(0);
  const [isPointing, setIsPointing] = useState(false);
  const [handedness, setHandedness] = useState<'Left' | 'Right' | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [openness, setOpenness] = useState<number>(0);
  const [hands, setHands] = useState<Partial<Record<'Left' | 'Right', TrackedHand>>>({});
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);

  // Initialize MediaPipe
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        
        const createLandmarker = (delegate: 'GPU' | 'CPU') =>
          HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe/models/hand_landmarker.task',
              delegate,
            },
            runningMode: 'VIDEO',
            numHands: 1,
          });

        let handLandmarker: HandLandmarker;
        try {
          handLandmarker = await createLandmarker('GPU');
        } catch {
          // Older browsers may not expose the GPU APIs MediaPipe requires.
          handLandmarker = await createLandmarker('CPU');
        }

        if (active) {
          landmarkerRef.current = handLandmarker;
          setIsReady(true);
        }
      } catch (err) {
        console.error("Failed to initialize MediaPipe:", err);
      }
    };

    init();

    return () => {
      active = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, []);

  // Request the camera immediately. Model initialization continues in parallel.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!enabled) {
      const existingStream = video.srcObject as MediaStream | null;
      existingStream?.getTracks().forEach(track => track.stop());
      video.pause();
      video.srcObject = null;
      return;
    }

    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 30, max: 30 },
        },
      })
      .then((mediaStream) => {
        stream = mediaStream;
        video.srcObject = mediaStream;
        return video.play();
      })
      .catch((err) => console.error('Webcam error:', err));

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [enabled]);

  // Process video frames as soon as the hand-tracking model is ready.
  useEffect(() => {
    if (!enabled) {
      setDetected(false);
      setFingerCount(0);
      setIsPointing(false);
      setHandedness(null);
      setPointerPosition(null);
      setOpenness(0);
      return;
    }
    if (!isReady || !videoRef.current) return;

    const video = videoRef.current;

    let lastVideoTime = -1;
    let lastDetectionTime = 0;

    const tick = (timestamp: number) => {
      if (video.readyState === video.HAVE_ENOUGH_DATA && landmarkerRef.current) {
        const shouldDetect =
          timestamp - lastDetectionTime >= DETECTION_INTERVAL_MS &&
          lastVideoTime !== video.currentTime;

        if (shouldDetect) {
          lastDetectionTime = timestamp;
          lastVideoTime = video.currentTime;
          
          const results = landmarkerRef.current.detectForVideo(video, timestamp);
          
          if (results.landmarks && results.landmarks.length > 0) {
            setDetected(true);
            const videoRect = video.getBoundingClientRect();
            const videoWidth = video.videoWidth || 480;
            const videoHeight = video.videoHeight || 360;
            const coverScale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
            const renderedWidth = videoWidth * coverScale;
            const renderedHeight = videoHeight * coverScale;
            const cropX = (renderedWidth - videoRect.width) / 2;
            const cropY = (renderedHeight - videoRect.height) / 2;
            const trackedHands: Partial<Record<'Left' | 'Right', TrackedHand>> = {};
            results.landmarks.forEach((landmarks, handIndex) => {
              const label = results.handednesses?.[handIndex]?.[0]?.categoryName;
              if (label !== 'Left' && label !== 'Right') return;
              const wrist = landmarks[0];
              const joints = [{ tip: 8, middle: 6 }, { tip: 12, middle: 10 }, { tip: 16, middle: 14 }, { tip: 20, middle: 18 }];
              const extended = joints.filter(({ tip, middle }) =>
                Math.hypot(landmarks[tip].x - wrist.x, landmarks[tip].y - wrist.y) >
                Math.hypot(landmarks[middle].x - wrist.x, landmarks[middle].y - wrist.y) * 1.12,
              );
              const indexPointing = extended.some(finger => finger.tip === 8);
              const pointer = landmarks[8];
              const unmirroredX = pointer.x * renderedWidth - cropX;
              const dTip = Math.hypot(pointer.x - wrist.x, pointer.y - wrist.y);
              const dBase = Math.hypot(landmarks[9].x - wrist.x, landmarks[9].y - wrist.y);
              trackedHands[label] = {
                handedness: label,
                fingerCount: extended.length,
                isPointing: indexPointing,
                openness: Math.min(Math.max((dTip / dBase) / 2.5, 0), 1) * 100,
                pointerPosition: indexPointing ? {
                  x: videoRect.left + videoRect.width - unmirroredX,
                  y: videoRect.top + pointer.y * renderedHeight - cropY,
                } : null,
              };
            });
            setHands(trackedHands);
            const detectedHand = results.handednesses?.[0]?.[0]?.categoryName;
            setHandedness(
              detectedHand === 'Left' || detectedHand === 'Right'
                ? detectedHand
                : null,
            );
            const hand = results.landmarks[0];
            const wrist = hand[0];
            const middleBase = hand[9]; // used as reference for distance

            // A finger is extended when its tip is meaningfully farther from
            // the wrist than its middle joint. The index fingertip is the
            // pointer; averaging several fingertips makes the cursor drift away
            // from the point the player is actually aiming with.
            const fingerJoints = [
              { tip: 8, middle: 6 },
              { tip: 12, middle: 10 },
              { tip: 16, middle: 14 },
              { tip: 20, middle: 18 },
            ];
            const extendedTips = fingerJoints
              .filter(({ tip, middle }) => {
                const tipDistance = Math.hypot(
                  hand[tip].x - wrist.x,
                  hand[tip].y - wrist.y,
                );
                const middleDistance = Math.hypot(
                  hand[middle].x - wrist.x,
                  hand[middle].y - wrist.y,
                );
                return tipDistance > middleDistance * 1.12;
              })
              .map(({ tip }) => hand[tip]);

            const visibleFingerCount = extendedTips.length;
            const indexExtended = extendedTips.includes(hand[8]);
            setFingerCount(visibleFingerCount);
            setIsPointing(indexExtended);

            if (indexExtended) {
              const pointer = hand[8];

              // Convert the landmark into its real screen position. This
              // accounts for both object-cover cropping and the mirrored video.
              const videoRect = video.getBoundingClientRect();
              const videoWidth = video.videoWidth || 480;
              const videoHeight = video.videoHeight || 360;
              const coverScale = Math.max(
                videoRect.width / videoWidth,
                videoRect.height / videoHeight,
              );
              const renderedWidth = videoWidth * coverScale;
              const renderedHeight = videoHeight * coverScale;
              const cropX = (renderedWidth - videoRect.width) / 2;
              const cropY = (renderedHeight - videoRect.height) / 2;
              const unmirroredX = pointer.x * renderedWidth - cropX;

              setPointerPosition({
                x: videoRect.left + videoRect.width - unmirroredX,
                y: videoRect.top + pointer.y * renderedHeight - cropY,
              });
            } else {
              setPointerPosition(null);
            }

            // Calculate openness (distance wrist to index tip relative to hand size)
            const indexTip = hand[8];
            const dTip = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
            const dBase = Math.hypot(middleBase.x - wrist.x, middleBase.y - wrist.y);
            // normalized roughly: open hand might be dTip/dBase = 2.0 to 2.5
            const rawOpenness = (dTip / dBase) / 2.5; 
            const clampedOpenness = Math.min(Math.max(rawOpenness, 0), 1) * 100;
            setOpenness(clampedOpenness);
          } else {
            setHands({});
            setDetected(false);
            setFingerCount(0);
            setIsPointing(false);
            setHandedness(null);
            setPointerPosition(null);
      setOpenness(0);
      setHands({});
          }
        }
      }
      requestRef.current = requestAnimationFrame(tick);
    };

    requestRef.current = requestAnimationFrame(tick);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isReady, enabled]);

  return {
    pointerPosition,
    openness,
    detected,
    fingerCount,
    isPointing,
    handedness,
    isReady,
    videoRef,
    hands,
  };
}
