(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.V360Core = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function wrap(value, count) {
    if (!Number.isFinite(count) || count <= 0) return 0;
    return ((Math.round(value) % count) + count) % count;
  }

  function normalizeFrame(frame, count) {
    if (count <= 1) return 0;
    return wrap(frame, count) / (count - 1);
  }

  function frameFromNormalized(normalized, count) {
    if (count <= 1) return 0;
    return wrap(Math.round(clamp(normalized, 0, 1) * (count - 1)), count);
  }

  function mapIndex(frame, sourceCount, targetCount) {
    if (targetCount <= 1) return 0;
    if (sourceCount <= 1) return 0;
    const normalized = wrap(frame, sourceCount) / sourceCount;
    return wrap(Math.round(normalized * targetCount), targetCount);
  }

  function frameFromDrag(startFrame, deltaPixels, pixelsPerFrame, count) {
    const divisor = Math.max(1, Number(pixelsPerFrame) || 1);
    return wrap(startFrame + Math.round(deltaPixels / divisor), count);
  }

  class SharedTimeline {
    constructor(count) {
      this.count = Math.max(1, Math.round(count || 1));
      this.frame = 0;
      this.direction = 1;
    }
    setCount(nextCount, preserveAngle = true) {
      const next = Math.max(1, Math.round(nextCount || 1));
      const normalized = preserveAngle ? this.frame / this.count : 0;
      this.count = next;
      this.frame = wrap(Math.round(normalized * next), next);
      return this.frame;
    }
    setFrame(nextFrame) {
      this.frame = wrap(nextFrame, this.count);
      return this.frame;
    }
    step(amount = 1) {
      return this.setFrame(this.frame + amount * this.direction);
    }
    reverse() {
      this.direction *= -1;
      return this.direction;
    }
  }

  return { clamp, wrap, normalizeFrame, frameFromNormalized, mapIndex, frameFromDrag, SharedTimeline };
});
