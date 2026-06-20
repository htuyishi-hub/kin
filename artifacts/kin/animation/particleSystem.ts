import { WELCOME_CONFIG } from '../constants/welcomeConfig';

export type ParticlePhase = 'idle' | 'scatter' | 'gather' | 'assembled';

export type Particle = {
  x:            number;
  y:            number;
  vx:           number;
  vy:           number;
  radius:       number;
  alpha:        number;
  targetX:      number;
  targetY:      number;
  phase:        ParticlePhase;
  overshootMag: number;
  hasOvershot:  boolean;
};

const { gravity: GRAVITY, damping: DAMPING } = WELCOME_CONFIG.particles;

export function initParticles(
  shadowACenter: { x: number; y: number },
  shadowBCenter: { x: number; y: number }
): Particle[] {
  const count = WELCOME_CONFIG.particles.count;
  const halfCount = Math.floor(count / 2);
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const fromA  = i < halfCount;
    const source = fromA ? shadowACenter : shadowBCenter;
    const angle  = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(Math.random()) * 30;

    const vel = WELCOME_CONFIG.particles.scatterVelocity;
    particles.push({
      x:  source.x + Math.cos(angle) * radial,
      y:  source.y + Math.sin(angle) * radial * 2.5,
      vx: (Math.random() - 0.5) * vel,
      vy: (Math.random() - 0.5) * vel,
      radius:      WELCOME_CONFIG.particles.radiusMin
                   + Math.random() * (WELCOME_CONFIG.particles.radiusMax - WELCOME_CONFIG.particles.radiusMin),
      alpha:       WELCOME_CONFIG.particles.alphaMin
                   + Math.random() * (WELCOME_CONFIG.particles.alphaMax - WELCOME_CONFIG.particles.alphaMin),
      targetX:     0,
      targetY:     0,
      phase:       'idle',
      overshootMag: WELCOME_CONFIG.particles.overshootMin
                    + Math.random() * (WELCOME_CONFIG.particles.overshootMax - WELCOME_CONFIG.particles.overshootMin),
      hasOvershot:  false,
    });
  }
  return particles;
}

export function updateParticles(
  particles: Particle[],
  phase: 'scatter' | 'gather'
): void {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    if (phase === 'scatter') {
      p.vx *= DAMPING;
      p.vy *= DAMPING;
      p.x  += p.vx;
      p.y  += p.vy;

    } else if (phase === 'gather') {
      const dx   = p.targetX - p.x;
      const dy   = p.targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.5) {
        p.vx += dx * GRAVITY;
        p.vy += dy * GRAVITY;
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x  += p.vx;
        p.y  += p.vy;
      } else if (!p.hasOvershot) {
        const ovAngle = Math.atan2(dy, dx);
        p.x = p.targetX + Math.cos(ovAngle) * p.overshootMag;
        p.y = p.targetY + Math.sin(ovAngle) * p.overshootMag;
        p.vx = -p.vx * 0.3;
        p.vy = -p.vy * 0.3;
        p.hasOvershot = true;
      } else {
        p.x    = p.targetX;
        p.y    = p.targetY;
        p.vx   = 0;
        p.vy   = 0;
        p.phase = 'assembled';
      }
    }
  }
}
