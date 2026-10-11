import { SpotMotionConfig } from '../types';

export function getActionMotionCycles(
  motion: Pick<SpotMotionConfig, 'speed' | 'speedProfile'>,
  elapsedSeconds: number
): number {
  const elapsed = Math.max(0, elapsedSeconds);
  const baseSpeed = Number.isFinite(motion.speed) && motion.speed > 0 ? motion.speed : 1;
  const keyframes = (motion.speedProfile || [])
    .filter(
      (keyframe) =>
        Number.isFinite(keyframe.timeSeconds) &&
        keyframe.timeSeconds >= 0 &&
        Number.isFinite(keyframe.speed) &&
        keyframe.speed > 0
    )
    .slice()
    .sort((a, b) => a.timeSeconds - b.timeSeconds);

  let cycles = 0;
  let segmentStartTime = 0;
  let segmentStartSpeed = baseSpeed;

  for (let index = 0; index < keyframes.length; index += 1) {
    const keyframe = keyframes[index];
    if (keyframe.timeSeconds <= segmentStartTime) {
      segmentStartSpeed = keyframe.speed;
      continue;
    }

    const segmentEndTime = Math.min(elapsed, keyframe.timeSeconds);
    if (segmentEndTime > segmentStartTime) {
      const progress =
        (segmentEndTime - segmentStartTime) /
        (keyframe.timeSeconds - segmentStartTime);
      const endSpeed =
        segmentStartSpeed + (keyframe.speed - segmentStartSpeed) * progress;
      cycles += ((segmentStartSpeed + endSpeed) / 2) * (segmentEndTime - segmentStartTime);
    }

    if (elapsed <= keyframe.timeSeconds) {
      return cycles;
    }

    segmentStartTime = keyframe.timeSeconds;
    segmentStartSpeed = keyframe.speed;
  }

  if (elapsed > segmentStartTime) {
    cycles += segmentStartSpeed * (elapsed - segmentStartTime);
  }

  return cycles;
}

export function getActionMotionFactor(
  motion: Pick<SpotMotionConfig, 'speed' | 'speedProfile' | 'loop'>,
  elapsedSeconds: number
): number {
  const cycles = getActionMotionCycles(motion, elapsedSeconds);
  return motion.loop
    ? (1 - Math.cos(cycles * 2 * Math.PI)) / 2
    : Math.min(cycles, 1);
}
