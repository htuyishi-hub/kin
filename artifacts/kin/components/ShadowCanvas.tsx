import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Fill,
  Group,
  Path,
  Circle,
  BlurMask,
  Picture,
  RadialGradient,
  LinearGradient,
  Skia,
  type SkPicture,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

import { buildShadowPath }                     from '../animation/shadowPath';
import { buildKPath, assignParticlesToTargets } from '../animation/kPath';
import { initParticles, updateParticles, type Particle } from '../animation/particleSystem';
import { WELCOME_CONFIG }                       from '../constants/welcomeConfig';
import { Colors }                               from '../constants/colors';

type AnimPhase =
  | 'dark' | 'enter' | 'slow' | 'converge'
  | 'scatter' | 'gather' | 'text' | 'fadeout';

interface ShadowCanvasProps {
  textOpacity:   SharedValue<number>;
  screenWidth:   number;
  screenHeight:  number;
}

const SHADOW_COLOR = '#D8D0C8';

export function ShadowCanvas({ textOpacity, screenWidth: W, screenHeight: H }: ShadowCanvasProps) {
  const centerX = W / 2;
  const groundY = H * WELCOME_CONFIG.shadow.groundYRatio;
  const logoCenterY = H * WELCOME_CONFIG.kForm.centerRatio;
  const logoSize = H * WELCOME_CONFIG.kForm.heightRatio;

  const animPhase = useRef<AnimPhase>('dark');
  const looping   = useRef(true);

  const shadowAX       = useSharedValue(-80);
  const shadowBX       = useSharedValue(W + 80);
  const shadowOpacity  = useSharedValue(1);
  const bloomIntensity = useSharedValue(0.05);
  const kOpacity       = useSharedValue(0);

  const walkBobA = useDerivedValue(
    () => Math.sin(shadowAX.value * WELCOME_CONFIG.shadow.walkBobFrequency)
          * WELCOME_CONFIG.shadow.walkBobAmplitude
  );
  const walkBobB = useDerivedValue(
    () => Math.sin(shadowBX.value * -WELCOME_CONFIG.shadow.walkBobFrequency)
          * WELCOME_CONFIG.shadow.walkBobAmplitude
  );

  const transformA = useDerivedValue(() => [
    { translateX: shadowAX.value },
    { translateY: walkBobA.value },
  ]);
  const transformB = useDerivedValue(() => [
    { translateX: shadowBX.value },
    { translateY: walkBobB.value },
  ]);

  const shadowPath = useMemo(() => buildShadowPath(0, groundY, 1.0), [groundY]);
  const kData = useMemo(() => {
    return buildKPath(centerX, logoCenterY, logoSize);
  }, [centerX, logoCenterY, logoSize]);

  const particles = useRef<Particle[]>([]);

  const emptyPicture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    rec.beginRecording({ x: 0, y: 0, width: 1, height: 1 });
    return rec.finishRecordingAsPicture();
  }, []);
  const dynamicPicture = useSharedValue<SkPicture>(emptyPicture);

  useEffect(() => {
    const C  = WELCOME_CONFIG.timing;
    const p5Start  = C.darknessDuration + C.enterDuration + C.slowDuration + C.convergeDuration;
    const p6Start  = p5Start + C.scatterDuration + C.gatherDuration;
    const loopEnd  = p6Start + C.textHoldDuration;

    const runSequence = () => {
      animPhase.current   = 'dark';
      shadowAX.value      = -80;
      shadowBX.value      = W + 80;
      shadowOpacity.value = 1;
      kOpacity.value      = 0;
      bloomIntensity.value = withTiming(0.12, { duration: C.darknessDuration });

      setTimeout(() => {
        animPhase.current = 'enter';
        shadowAX.value = withTiming(W * WELCOME_CONFIG.shadow.entryXRatioA, {
          duration: C.enterDuration, easing: Easing.out(Easing.cubic),
        });
        shadowBX.value = withTiming(W * WELCOME_CONFIG.shadow.entryXRatioB, {
          duration: C.enterDuration, easing: Easing.out(Easing.cubic),
        });
      }, C.darknessDuration);

      setTimeout(() => {
        animPhase.current = 'slow';
      }, C.darknessDuration + C.enterDuration);

      setTimeout(() => {
        animPhase.current    = 'converge';
        bloomIntensity.value = withTiming(0.60, { duration: C.convergeDuration });
        shadowAX.value = withTiming(centerX, {
          duration: C.convergeDuration, easing: Easing.inOut(Easing.quad),
        });
        shadowBX.value = withTiming(centerX, {
          duration: C.convergeDuration, easing: Easing.inOut(Easing.quad),
        });
      }, C.darknessDuration + C.enterDuration + C.slowDuration);

      setTimeout(() => {
        animPhase.current    = 'scatter';
        shadowOpacity.value  = withTiming(0, { duration: 250 });
        bloomIntensity.value = withTiming(0.3, { duration: 400 });
        particles.current    = initParticles(
          { x: centerX, y: groundY - 70 },
          { x: centerX, y: groundY - 70 }
        );
        assignParticlesToTargets(particles.current, kData.targets);
        setTimeout(() => { animPhase.current = 'gather'; }, C.scatterDuration);
      }, p5Start);

      setTimeout(() => {
        animPhase.current    = 'text';
        kOpacity.value       = withTiming(1, { duration: 400 });
        textOpacity.value    = withTiming(1, { duration: WELCOME_CONFIG.tagline.fadeInDuration });
        setTimeout(() => {
          kOpacity.value = withSequence(
            withTiming(1.0, { duration: 200 }),
            withTiming(0.75, { duration: 200 }),
            withTiming(1.0, { duration: 350 })
          );
        }, 500);
      }, p6Start);

      setTimeout(() => {
        animPhase.current    = 'fadeout';
        textOpacity.value    = withTiming(0, { duration: C.fadeOutDuration });
        bloomIntensity.value = withTiming(0.05, { duration: C.fadeOutDuration });
        kOpacity.value       = withTiming(0, { duration: C.fadeOutDuration });
        shadowOpacity.value  = withTiming(0, { duration: C.fadeOutDuration });

        setTimeout(() => {
          if (looping.current) {
            particles.current = [];
            const rec = Skia.PictureRecorder();
            rec.beginRecording({ x: 0, y: 0, width: 1, height: 1 });
            dynamicPicture.value = rec.finishRecordingAsPicture();
            runSequence();
          }
        }, C.fadeOutDuration + 200);
      }, loopEnd);
    };

    runSequence();
    return () => { looping.current = false; };
  }, [W, H]);

  useEffect(() => {
    let rafId: number;

    const frame = () => {
      const phase = animPhase.current;

      if (phase === 'converge' || phase === 'scatter' || phase === 'gather') {
        const rec = Skia.PictureRecorder();
        const cv  = rec.beginRecording({ x: 0, y: 0, width: W, height: H });
        const pnt = Skia.Paint();

        if (phase === 'converge') {
          const ax = shadowAX.value;
          const bx = shadowBX.value;
          pnt.setColor(Skia.Color('#2563EB'));
          pnt.setAlphaf(WELCOME_CONFIG.threads.alpha);
          pnt.setStrokeWidth(WELCOME_CONFIG.threads.width);
          const nc = WELCOME_CONFIG.threads.count;
          for (let t = 0; t < nc; t++) {
            const y = groundY + WELCOME_CONFIG.threads.yOffset
                      + (t - nc / 2) * WELCOME_CONFIG.threads.ySpacing;
            cv.drawLine(ax, y, bx, y, pnt);
          }
        }

        if (phase === 'scatter' || phase === 'gather') {
          updateParticles(
            particles.current,
            phase === 'scatter' ? 'scatter' : 'gather'
          );
          for (const p of particles.current) {
            pnt.setColor(Skia.Color(p.x < centerX ? '#38BDF8' : '#2563EB'));
            pnt.setAlphaf(p.alpha);
            cv.drawCircle(p.x, p.y, p.radius, pnt);
          }
        }

        dynamicPicture.value = rec.finishRecordingAsPicture();
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [W, H, groundY]);

  const boomY = groundY + WELCOME_CONFIG.bloom.sourceYOffset;

  return (
    <Canvas style={styles.canvas}>
      <Fill color={Colors.night} />

      <Circle cx={centerX} cy={boomY} r={WELCOME_CONFIG.bloom.radius} opacity={bloomIntensity}>
        <RadialGradient
          c={{ x: centerX, y: boomY }}
          r={WELCOME_CONFIG.bloom.radius}
          colors={['rgba(240,230,210,0.35)', 'rgba(240,230,210,0)']}
        />
      </Circle>

      <Group transform={transformA as any} opacity={shadowOpacity}>
        <Path path={shadowPath} color={SHADOW_COLOR} opacity={WELCOME_CONFIG.shadow.alphaOuter}>
          <BlurMask blur={WELCOME_CONFIG.shadow.blurOuter} style="normal" />
        </Path>
        <Path path={shadowPath} color={SHADOW_COLOR} opacity={WELCOME_CONFIG.shadow.alphaCore}>
          <BlurMask blur={WELCOME_CONFIG.shadow.blurCore} style="normal" />
        </Path>
        <Path path={shadowPath} color={SHADOW_COLOR} opacity={WELCOME_CONFIG.shadow.alphaCenter}>
          <BlurMask blur={WELCOME_CONFIG.shadow.blurCenter} style="normal" />
        </Path>
      </Group>

      <Group transform={transformB as any} opacity={shadowOpacity}>
        <Path path={shadowPath} color={SHADOW_COLOR} opacity={WELCOME_CONFIG.shadow.alphaOuter}>
          <BlurMask blur={WELCOME_CONFIG.shadow.blurOuter} style="normal" />
        </Path>
        <Path path={shadowPath} color={SHADOW_COLOR} opacity={WELCOME_CONFIG.shadow.alphaCore}>
          <BlurMask blur={WELCOME_CONFIG.shadow.blurCore} style="normal" />
        </Path>
        <Path path={shadowPath} color={SHADOW_COLOR} opacity={WELCOME_CONFIG.shadow.alphaCenter}>
          <BlurMask blur={WELCOME_CONFIG.shadow.blurCenter} style="normal" />
        </Path>
      </Group>

      <Picture picture={dynamicPicture as any} />

      <Group opacity={kOpacity}>
        <Path
          path={kData.path}
          style="stroke"
          strokeWidth={WELCOME_CONFIG.kForm.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
        >
          <LinearGradient
            start={{ x: centerX - logoSize * 0.7, y: logoCenterY }}
            end={{ x: centerX + logoSize * 0.7, y: logoCenterY }}
            colors={['#38BDF8', '#2563EB']}
          />
        </Path>
      </Group>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default ShadowCanvas;
