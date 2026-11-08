import { useEffect, useState, useRef } from 'react';
import { getEstimatedServerTime } from '../services/firebase';

interface UseGameTimerProps {
  roundStartedAt: number;
  durationSec: number;
  isActive: boolean;
  onTimeExpired?: () => void;
}

export function useGameTimer({
  roundStartedAt,
  durationSec,
  isActive,
  onTimeExpired,
}: UseGameTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(durationSec);
  const expiredHandledRef = useRef<boolean>(false);
  const onTimeExpiredRef = useRef(onTimeExpired);
  onTimeExpiredRef.current = onTimeExpired;

  useEffect(() => {
    expiredHandledRef.current = false;
  }, [roundStartedAt, durationSec, isActive]);

  useEffect(() => {
    if (!isActive || !roundStartedAt || durationSec <= 0) {
      setSecondsLeft(durationSec);
      return;
    }

    const checkTime = () => {
      const now = getEstimatedServerTime();
      const elapsedMs = now - roundStartedAt;
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const remaining = Math.max(0, durationSec - elapsedSec);

      setSecondsLeft(remaining);

      if (remaining <= 0 && !expiredHandledRef.current) {
        expiredHandledRef.current = true;
        if (onTimeExpiredRef.current) {
          onTimeExpiredRef.current();
        }
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 250);

    return () => clearInterval(interval);
  }, [roundStartedAt, durationSec, isActive]);

  const progressPercent = durationSec > 0 ? (secondsLeft / durationSec) * 100 : 0;
  const halfwayThreshold = Math.floor(durationSec / 2);
  const isHalfway = durationSec > 0 && secondsLeft <= halfwayThreshold;
  const secondsUntilHalfway = Math.max(0, secondsLeft - halfwayThreshold);

  return {
    secondsLeft,
    progressPercent,
    isUrgent: secondsLeft <= 10 && secondsLeft > 0,
    isHalfway,
    secondsUntilHalfway,
  };
}
