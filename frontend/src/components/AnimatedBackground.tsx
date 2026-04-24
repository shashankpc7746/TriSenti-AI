import React, { useMemo } from 'react';
import { motion } from 'motion/react';

// Stable particle data computed once at module level — never changes between renders
const PARTICLE_COUNT = 20;
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  id: i,
  left: `${((i * 37 + 13) % 100).toFixed(1)}%`,   // deterministic spread, no Math.random()
  duration: 10 + (i % 10),                          // 10-19 s
  delay: (i * 0.25) % 5,                            // 0-4.75 s, evenly spaced
}));

export function AnimatedBackground() {
  // Respect user's motion preference — skip all animations if requested
  const prefersReduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  if (prefersReduced) {
    // Still render the static gradient grid but no moving parts
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Floating gradient orbs */}
      <motion.div
        animate={{ x: [0, 100, 0], y: [0, -100, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
      />

      <motion.div
        animate={{ x: [0, -100, 0], y: [0, 100, 0], scale: [1, 1.3, 1] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 right-20 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl"
      />

      <motion.div
        animate={{ x: [0, 50, 0], y: [0, -50, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-20 left-1/3 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl"
      />

      {/* Stable particles — deterministic positions, no Math.random() in render */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          animate={{ y: [-20, -1000], opacity: [0, 1, 0] }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear',
          }}
          className="absolute w-1 h-1 bg-blue-400/50 rounded-full"
          style={{ left: p.left, bottom: 0 }}
        />
      ))}

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
    </div>
  );
}
