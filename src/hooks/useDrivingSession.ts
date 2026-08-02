import { useEffect, useRef, useState } from 'react';

// Requirement #8 — driver fatigue detection: track continuous driving
// duration, detect lack of rest periods, notify to take a break.
const MOVING_SPEED_MS = 2.5; // ~9 km/h — below this we treat the driver as stopped/idling.
const STOP_RESET_MS = 5 * 60 * 1000; // a 5-minute stop counts as a real rest, resetting the session.
const FATIGUE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 continuous hours triggers the break alert.
const SNOOZE_MS = 15 * 60 * 1000; // re-warn 15 minutes after being dismissed if still driving.

interface DrivingSession {
  drivingMinutes: number;
  needsBreak: boolean;
  acknowledge: () => void;
}

export function useDrivingSession(speedMetersPerSecond: number | null): DrivingSession {
  const [drivingMs, setDrivingMs] = useState(0);
  const [needsBreak, setNeedsBreak] = useState(false);
  const lastMovingTickRef = useRef<number | null>(null);
  const lastMovementAtRef = useRef<number | null>(null);
  const snoozeUntilRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    const isMoving = (speedMetersPerSecond ?? 0) >= MOVING_SPEED_MS;

    if (isMoving) {
      if (lastMovingTickRef.current !== null) {
        setDrivingMs((prev) => prev + (now - lastMovingTickRef.current!));
      }
      lastMovingTickRef.current = now;
      lastMovementAtRef.current = now;
    } else {
      lastMovingTickRef.current = null;
      if (lastMovementAtRef.current !== null && now - lastMovementAtRef.current > STOP_RESET_MS) {
        setDrivingMs(0);
        setNeedsBreak(false);
        lastMovementAtRef.current = null;
      }
    }
  }, [speedMetersPerSecond]);

  useEffect(() => {
    if (drivingMs >= FATIGUE_THRESHOLD_MS && Date.now() > snoozeUntilRef.current) {
      setNeedsBreak(true);
    }
  }, [drivingMs]);

  const acknowledge = () => {
    snoozeUntilRef.current = Date.now() + SNOOZE_MS;
    setNeedsBreak(false);
  };

  return { drivingMinutes: Math.floor(drivingMs / 60000), needsBreak, acknowledge };
}
