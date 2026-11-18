import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVip } from '../context/VipContext';
import { playUiSound } from '../utils/soundFx';
import { Volume2, Sparkles, Hand, EyeOff, MessageCircle, Mic, Send, SlidersHorizontal } from 'lucide-react';

type MascotMood = 'idle' | 'walk' | 'jump' | 'wave' | 'talk' | 'think' | 'celebrate';

const LOCAL_JOKES_EN = [
  "Anas Ali built VIP AI to turn wild ideas into real code, 3D worlds, and games!",
  "Why did the shader go to therapy? It had too many unresolved reflections!",
  "I tried to learn Unreal Engine Blueprints, and now my thoughts look like spaghetti!",
  "What's a chess knight's favorite dance? The L-step shuffle!",
  "I asked the compiler for a joke, and it returned 42 warnings and a smile!",
];

const LOCAL_JOKES_AR = [
  'أنس علي هو الذي صمّم وأنشأ منصة VIP AI لتحويل الأفكار إلى تطبيقات وألعاب حقيقية!',
  'لماذا ذهب المبرمج إلى طبيب العيون؟ لأنه لم يستطع رؤية الـ C# بوضوح!',
  'ما هي الرقصة المفضلة للحصان في الشطرنج؟ خطوة حرف L السريعة!',
  'سألت محرك الألعاب عن الطقس اليوم، فقال لي: إضاءة Lumen ذهبية مع احتمال سقوط فيزياء!',
  'لماذا يحب المبدعون القهوة؟ لأنها تحول الأكواد المعقدة إلى مشاريع حقيقية!',
];

export function RubberHoseMascot() {
  const { settings, updateSettings, mascotSignal, t, isRtl } = useVip();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSpeakingRef = useRef(false);

  const [speechText, setSpeechText] = useState<string>('');
  const [showBubble, setShowBubble] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [listening, setListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [bubbleOnLeft, setBubbleOnLeft] = useState(true);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Physics & skeletal animation state stored in ref for 60fps loop with zero React re-renders
  const simRef = useRef({
    x: 120,
    y: 0,
    vx: 0,
    vy: 0,
    targetX: 280,
    facing: 1,
    mood: 'walk' as MascotMood,
    moodTimer: 2.2,
    phase: 0,
    blinkTimer: 2.5,
    isBlinking: false,
    cursorX: 400,
    cursorY: 300,
    dragging: false,
    movedDuringDrag: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    mouthOpen: 0,
    initialized: false,
  });

  const syncDomTransform = useCallback((x: number, y: number) => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translate3d(${Math.round(x - 64)}px, ${Math.round(y - 114)}px, 0)`;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback(
    async (text: string) => {
      if (!text) return;
      setSpeechText(text);
      setShowBubble(true);
      simRef.current.mood = 'talk';
      simRef.current.moodTimer = Math.max(2.8, Math.min(7, text.length * 0.06));

      if (!settings.mascotVoice || !settings.soundEnabled) return;

      stopSpeech();
      setIsSpeaking(true);

      // Try Gemini TTS first, fall back to browser Web Speech API
      try {
        const res = await fetch('/api/ai/audio/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceName: 'Puck',
            style: 'Playful, expressive, warm 1930s cartoon host',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.audioDataUrl) {
            const audio = new Audio(data.audioDataUrl);
            audio.volume = Math.max(0.1, Math.min(1, settings.soundVolume));
            audioRef.current = audio;
            audio.onended = () => setIsSpeaking(false);
            audio.onerror = () => setIsSpeaking(false);
            await audio.play().catch(() => setIsSpeaking(false));
            return;
          }
        }
      } catch {
        // Fallback to SpeechSynthesis
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = settings.language === 'ar' ? 'ar-SA' : 'en-US';
          utter.pitch = 1.15;
          utter.rate = 1.05;
          utter.volume = Math.max(0.1, Math.min(1, settings.soundVolume));
          utter.onend = () => setIsSpeaking(false);
          utter.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utter);
          return;
        } catch {
          setIsSpeaking(false);
        }
      }
      setIsSpeaking(false);
    },
    [settings.mascotVoice, settings.soundEnabled, settings.soundVolume, settings.language, stopSpeech]
  );

  const askMascot = useCallback(
    async (trigger: 'joke' | 'chat_reaction' | 'greeting' | 'chess', context = '') => {
      if (isBusy) return;
      setIsBusy(true);
      simRef.current.mood = 'think';
      simRef.current.moodTimer = 2.0;

      try {
        const res = await fetch('/api/ai/mascot/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger, language: settings.language, context }),
        });
        const data = await res.json();
        if (res.ok && data.line) {
          await speakText(data.line);
          return;
        }
      } catch {
        // Use local fallback
      } finally {
        setIsBusy(false);
      }

      const pool = settings.language === 'ar' ? LOCAL_JOKES_AR : LOCAL_JOKES_EN;
      const fallback = pool[Math.floor(Math.random() * pool.length)];
      await speakText(fallback);
    },
    [isBusy, settings.language, speakText]
  );

  const talkToCharacter = useCallback(
    async (userMsg: string) => {
      const cleaned = userMsg.trim();
      if (!cleaned || isBusy) return;
      setChatInput('');
      setIsBusy(true);
      simRef.current.mood = 'think';
      simRef.current.moodTimer = 2.4;
      setShowBubble(true);
      try {
        const res = await fetch('/api/ai/mascot/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: 'chat_reaction',
            language: settings.language,
            context: `User directly asks/tells you: "${cleaned}". Answer helpfully & playfully in character.`,
          }),
        });
        const data = await res.json();
        if (res.ok && data.line) {
          await speakText(data.line);
          return;
        }
      } catch {
        // fallback below
      } finally {
        setIsBusy(false);
      }
      await speakText(
        settings.language === 'ar'
          ? 'أنا بيب! تم تطوير منصة VIP AI بواسطة أنس علي. كيف أساعدك؟'
          : 'Pip here! VIP AI was built by Anas Ali — tell me what we are creating today!'
      );
    },
    [isBusy, settings.language, speakText]
  );

  const startVoiceWithPip = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SpeechRec) {
      setShowBubble(true);
      setSpeechText(
        settings.language === 'ar'
          ? 'التعرف على الصوت غير مدعوم هنا — اكتب رسالتك لي!'
          : 'Voice recognition unavailable in this browser — type a message below!'
      );
      return;
    }
    const rec = new SpeechRec() as {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };
    rec.lang = settings.language === 'ar' ? 'ar-SA' : 'en-US';
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript;
      if (transcript) void talkToCharacter(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  // React to workspace signals (chat messages, chess events, celebrations)
  useEffect(() => {
    if (!mascotSignal || !settings.mascotVisible) return;
    if (mascotSignal.type === 'celebrate') {
      simRef.current.mood = 'celebrate';
      simRef.current.vy = -280;
      simRef.current.moodTimer = 2.4;
      if (mascotSignal.text) {
        speakText(mascotSignal.text);
      }
    } else if (mascotSignal.type === 'chess' || mascotSignal.type === 'chat_reaction') {
      askMascot(mascotSignal.type, mascotSignal.text || '');
    } else if (mascotSignal.type === 'joke') {
      askMascot('joke');
    } else if (mascotSignal.type === 'greeting') {
      speakText(t.mascot.defaultGreeting);
    }
  }, [mascotSignal, settings.mascotVisible, askMascot, speakText, t.mascot.defaultGreeting]);

  // Auto-hide speech bubble only if quick settings / typing not active
  useEffect(() => {
    if (!showBubble || isSpeaking || showQuickSettings || chatInput.trim().length > 0) return;
    const timer = window.setTimeout(() => setShowBubble(false), 9000);
    return () => window.clearTimeout(timer);
  }, [showBubble, isSpeaking, showQuickSettings, chatInput, speechText]);

  // Track pointer for eye-follow & dragging
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      simRef.current.cursorX = e.clientX;
      simRef.current.cursorY = e.clientY;
      if (simRef.current.dragging) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        simRef.current.movedDuringDrag = true;
        simRef.current.x = Math.max(48, Math.min(vw - 48, e.clientX - simRef.current.dragOffsetX));
        simRef.current.y = Math.max(64, Math.min(vh - 64, e.clientY - simRef.current.dragOffsetY));
        syncDomTransform(simRef.current.x, simRef.current.y);
      }
    };
    const onUp = () => {
      if (simRef.current.dragging) {
        simRef.current.dragging = false;
        simRef.current.targetX = simRef.current.x;
        setBubbleOnLeft(simRef.current.x > window.innerWidth * 0.52);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [syncDomTransform]);

  // Main 60fps Rubber-Hose Canvas Animation & Screen Patrol Loop (ZERO React re-renders per frame!)
  useEffect(() => {
    if (!settings.mascotVisible) return;

    const sim = simRef.current;
    if (!sim.initialized) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      sim.x = isRtl ? 110 : vw - 110;
      sim.y = vh - 80;
      sim.targetX = isRtl ? Math.min(vw - 100, 280) : Math.max(100, vw - 280);
      sim.initialized = true;
      syncDomTransform(sim.x, sim.y);
      setBubbleOnLeft(sim.x > vw * 0.52);
    }

    let rafId = 0;
    let lastTime = performance.now();
    let bubbleSideAccum = 0;

    const renderFrame = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const speedMult = Math.max(0.4, Math.min(2.0, settings.mascotSpeed));
      const dt = rawDt * speedMult;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const floorY = vh - 76;

      // Blinking timer
      sim.blinkTimer -= rawDt;
      if (sim.blinkTimer <= 0) {
        sim.isBlinking = !sim.isBlinking;
        sim.blinkTimer = sim.isBlinking ? 0.13 : 2.2 + Math.random() * 2.5;
      }

      // Autonomous patrol state machine
      if (!sim.dragging) {
        sim.moodTimer -= dt;
        if (sim.moodTimer <= 0) {
          if (settings.mascotPatrol) {
            const roll = Math.random();
            if (roll < 0.55) {
              sim.mood = 'walk';
              // Pick a new patrol destination along bottom/mid screen
              sim.targetX = 90 + Math.random() * Math.max(120, vw - 180);
              sim.moodTimer = 2.5 + Math.random() * 2.5;
            } else if (roll < 0.78) {
              sim.mood = 'idle';
              sim.moodTimer = 2.0 + Math.random() * 2.0;
            } else if (roll < 0.9) {
              sim.mood = 'wave';
              sim.moodTimer = 1.6;
            } else {
              sim.mood = 'jump';
              sim.vy = -250;
              sim.moodTimer = 1.1;
            }
          } else {
            sim.mood = 'idle';
            sim.moodTimer = 2.0;
          }
        }

        // Horizontal movement during walk
        if (sim.mood === 'walk') {
          const dx = sim.targetX - sim.x;
          if (Math.abs(dx) < 8) {
            sim.vx = 0;
            sim.mood = 'idle';
            sim.moodTimer = 1.8;
          } else {
            const dir = Math.sign(dx);
            sim.facing = dir;
            sim.vx = dir * 92;
            sim.x = Math.max(52, Math.min(vw - 52, sim.x + sim.vx * dt));
          }
        } else {
          sim.vx = 0;
        }

        // Vertical gravity for jump / celebrate
        if (sim.y < floorY || sim.vy < 0) {
          sim.vy += 680 * dt;
          sim.y += sim.vy * dt;
          if (sim.y >= floorY) {
            sim.y = floorY;
            sim.vy = 0;
          }
        } else {
          sim.y = floorY;
        }
      }

      // Direct GPU transform update (zero React re-renders during patrol!)
      syncDomTransform(sim.x, sim.y);
      bubbleSideAccum += rawDt;
      if (bubbleSideAccum >= 0.7) {
        bubbleSideAccum = 0;
        const onLeft = sim.x > vw * 0.52;
        setBubbleOnLeft((prev) => (prev === onLeft ? prev : onLeft));
      }

      // Advance animation phase
      sim.phase += dt * (sim.mood === 'walk' ? 8.5 : sim.mood === 'celebrate' ? 10 : 3.4);

      // Mouth lip-sync envelope when speaking
      if (isSpeakingRef.current) {
        sim.mouthOpen = 0.35 + Math.abs(Math.sin(now * 0.018)) * 0.65;
      } else if (sim.mood === 'talk') {
        sim.mouthOpen = Math.max(0, Math.sin(now * 0.014) * 0.45);
      } else {
        sim.mouthOpen *= 0.8;
      }

      // Draw 1930s Rubber-Hose Character onto high-DPI canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        const size = 128;
        if (canvas.width !== size * dpr) {
          canvas.width = size * dpr;
          canvas.height = size * dpr;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, size, size);

          const cx = size / 2;
          const groundY = size - 14;
          const isWalking = sim.mood === 'walk';
          const isJumping = sim.y < floorY - 2;
          const bob = isWalking
            ? Math.abs(Math.sin(sim.phase)) * -5
            : Math.sin(sim.phase) * 2.2;
          const squashX = isJumping ? 0.92 : 1 + Math.sin(sim.phase * 2) * 0.018;
          const squashY = isJumping ? 1.08 : 1 - Math.sin(sim.phase * 2) * 0.018;

          // Ground shadow
          const shadowScale = Math.max(0.45, 1 - (floorY - sim.y) / 140);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
          ctx.beginPath();
          ctx.ellipse(cx, groundY + 4, 22 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.translate(cx, groundY);
          ctx.scale(sim.facing * squashX, squashY);

          const inkColor = '#111827';
          const strokeHighlight = settings.theme === 'dark' ? '#E2E8F0' : '#0F172A';
          const gloveColor = '#F8FAFC';

          // --- RUBBER-HOSE LEGS ---
          const legSwing = isWalking ? Math.sin(sim.phase) * 14 : isJumping ? 8 : 0;
          const legLiftL = isWalking ? Math.max(0, -Math.cos(sim.phase) * 8) : isJumping ? 7 : 0;
          const legLiftR = isWalking ? Math.max(0, Math.cos(sim.phase) * 8) : isJumping ? 5 : 0;

          const drawLeg = (hipX: number, footX: number, footY: number) => {
            ctx.strokeStyle = inkColor;
            ctx.lineWidth = 5.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(hipX, -34 + bob);
            ctx.quadraticCurveTo((hipX + footX) / 2 + 4, -18 + bob, footX, footY);
            ctx.stroke();

            // Subtle rim outline for dark mode legibility
            ctx.strokeStyle = strokeHighlight;
            ctx.lineWidth = 1.1;
            ctx.stroke();

            // Oversized 1930s cartoon shoe
            ctx.fillStyle = '#1E293B';
            ctx.strokeStyle = strokeHighlight;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.ellipse(footX + 5, footY + 1, 10.5, 5.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // White shoe highlight
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.beginPath();
            ctx.ellipse(footX + 7, footY - 1, 3.5, 1.5, -0.2, 0, Math.PI * 2);
            ctx.fill();
          };

          drawLeg(-8, -9 - legSwing, -3 - legLiftL);
          drawLeg(8, 9 + legSwing, -3 - legLiftR);

          // --- TORSO ---
          ctx.fillStyle = inkColor;
          ctx.strokeStyle = strokeHighlight;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(0, -45 + bob, 16, 17, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Classic studio bow-tie / collar accent (Electric Cobalt)
          ctx.fillStyle = '#3B82F6';
          ctx.beginPath();
          ctx.moveTo(0, -60 + bob);
          ctx.lineTo(-7, -64 + bob);
          ctx.lineTo(-7, -56 + bob);
          ctx.closePath();
          ctx.moveTo(0, -60 + bob);
          ctx.lineTo(7, -64 + bob);
          ctx.lineTo(7, -56 + bob);
          ctx.closePath();
          ctx.fill();

          // --- RUBBER-HOSE ARMS ---
          const armWave =
            sim.mood === 'wave' || sim.mood === 'celebrate'
              ? Math.sin(sim.phase * 2.2) * 14 - 24
              : isWalking
                ? -legSwing * 0.9
                : Math.sin(sim.phase) * 3;

          const drawArm = (
            sx: number,
            sy: number,
            ex: number,
            ey: number,
            ctrlX: number,
            ctrlY: number
          ) => {
            ctx.strokeStyle = inkColor;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(ctrlX, ctrlY, ex, ey);
            ctx.stroke();
            ctx.strokeStyle = strokeHighlight;
            ctx.lineWidth = 1.0;
            ctx.stroke();

            // White 3-finger cartoon glove
            ctx.fillStyle = gloveColor;
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.arc(ex, ey, 6.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          };

          // Back/left arm
          drawArm(
            -13,
            -51 + bob,
            -25,
            sim.mood === 'think' ? -72 + bob : -35 + bob + (isWalking ? legSwing * 0.7 : 0),
            -24,
            -46 + bob
          );
          // Front/right arm (waves or gestures)
          drawArm(
            13,
            -51 + bob,
            26,
            -38 + bob + armWave,
            24,
            -48 + bob + armWave * 0.4
          );

          // --- HEAD ---
          const headY = -76 + bob;
          ctx.fillStyle = inkColor;
          ctx.strokeStyle = strokeHighlight;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, headY, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Cream/ivory vintage face mask
          ctx.fillStyle = '#F8F4EC';
          ctx.beginPath();
          ctx.ellipse(2, headY + 3, 15.5, 13.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // --- PIE-CUT 1930s EYES ---
          const dxEye = Math.max(-2.5, Math.min(2.5, ((sim.cursorX - sim.x) / 250) * sim.facing));
          const dyEye = Math.max(-2, Math.min(2, (sim.cursorY - (sim.y - 76)) / 250));

          const drawEye = (ex: number, ey: number) => {
            if (sim.isBlinking) {
              ctx.strokeStyle = '#0F172A';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(ex - 4, ey);
              ctx.lineTo(ex + 4, ey);
              ctx.stroke();
              return;
            }
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.ellipse(ex, ey, 4.4, 6.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Pie-cut pupil
            const px = ex + dxEye;
            const py = ey + dyEye;
            ctx.fillStyle = '#0F172A';
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.arc(px, py, 2.7, 0.35, Math.PI * 2 - 0.35);
            ctx.closePath();
            ctx.fill();
          };

          drawEye(-4, headY - 1);
          drawEye(7, headY - 1);

          // Nose button
          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.ellipse(2.5, headY + 4.5, 3, 2, 0, 0, Math.PI * 2);
          ctx.fill();

          // --- EXPRESSIVE MOUTH (SYNCED TO SPEECH) ---
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 1.7;
          if (sim.mouthOpen > 0.12) {
            ctx.fillStyle = '#991B1B';
            ctx.beginPath();
            ctx.ellipse(2, headY + 9.5, 5.2, 1.5 + sim.mouthOpen * 4.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.beginPath();
            if (sim.mood === 'think') {
              ctx.moveTo(-2, headY + 10);
              ctx.lineTo(6, headY + 9);
            } else {
              ctx.arc(2, headY + 7.5, 6.5, 0.2, Math.PI - 0.2);
            }
            ctx.stroke();
          }

          // --- VINTAGE BOWLER HAT + CREATOR ANTENNA ---
          ctx.fillStyle = '#1E293B';
          ctx.strokeStyle = strokeHighlight;
          ctx.lineWidth = 1.4;
          // Hat brim
          ctx.beginPath();
          ctx.ellipse(0, headY - 16, 17, 4, -0.06, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Hat dome
          ctx.beginPath();
          ctx.arc(0, headY - 18, 10.5, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Hat band
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(-10, headY - 20, 20, 3);
          // Brass antenna
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, headY - 28);
          ctx.lineTo(0, headY - 35);
          ctx.stroke();
          ctx.fillStyle = isSpeaking ? '#60A5FA' : '#F59E0B';
          ctx.beginPath();
          ctx.arc(0, headY - 37, 3.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [settings.mascotVisible, settings.mascotPatrol, settings.mascotSpeed, settings.theme, isRtl, syncDomTransform]);

  if (!settings.mascotVisible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        transform: `translate3d(${Math.round(simRef.current.x - 64)}px, ${Math.round(simRef.current.y - 114)}px, 0)`,
      }}
      className="fixed top-0 left-0 z-40 pointer-events-none select-none will-change-transform"
      aria-label="Pip animated assistant mascot"
    >
      {/* Speech, Conversation & Quick-Settings Bubble */}
      {showBubble && (
        <div
          className={`pointer-events-auto absolute bottom-[122px] w-72 sm:w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs text-slate-800 dark:text-slate-100 ${
            bubbleOnLeft ? 'right-2' : 'left-2'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-200/70 dark:border-slate-800">
            <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              {t.mascot.name}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => askMascot('joke')}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white transition-colors"
                title={t.mascot.jokeBtn}
              >
                {t.mascot.jokeBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  simRef.current.mood = 'wave';
                  simRef.current.moodTimer = 2.0;
                  playUiSound('pop', settings.soundEnabled, settings.soundVolume);
                }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                title={t.mascot.waveBtn}
              >
                <Hand className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setShowQuickSettings((v) => !v)}
                className={`p-1 rounded ${showQuickSettings ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                title="Character Settings"
              >
                <SlidersHorizontal className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  stopSpeech();
                  updateSettings({ mascotVisible: false });
                }}
                className="p-1 rounded hover:bg-rose-500/15 hover:text-rose-500"
                title={t.mascot.hideBtn}
              >
                <EyeOff className="w-3 h-3" />
              </button>
            </div>
          </div>

          {showQuickSettings ? (
            <div className="space-y-2 py-1 text-[11px]">
              <label className="flex items-center justify-between cursor-pointer">
                <span>{t.settings.mascotPatrol}</span>
                <input
                  type="checkbox"
                  checked={settings.mascotPatrol}
                  onChange={(e) => updateSettings({ mascotPatrol: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>{t.settings.mascotVoice}</span>
                <input
                  type="checkbox"
                  checked={settings.mascotVoice}
                  onChange={(e) => updateSettings({ mascotVoice: e.target.checked })}
                />
              </label>
              <div className="flex items-center justify-between gap-2">
                <span>{t.settings.mascotSpeed}</span>
                <input
                  type="range"
                  min={0.5}
                  max={1.8}
                  step={0.1}
                  value={settings.mascotSpeed}
                  onChange={(e) => updateSettings({ mascotSpeed: Number(e.target.value) })}
                  className="w-24"
                />
                <span className="font-mono">{settings.mascotSpeed.toFixed(1)}x</span>
              </div>
            </div>
          ) : (
            <p className="leading-relaxed text-[12px] mb-2">{speechText || t.mascot.defaultGreeting}</p>
          )}

          {/* Direct Voice & Text Conversation Input with Living Character */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void talkToCharacter(chatInput);
            }}
            className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/70 dark:border-slate-800"
          >
            <button
              type="button"
              onClick={startVoiceWithPip}
              className={`p-1.5 rounded-lg border ${
                listening
                  ? 'border-rose-500 bg-rose-500 text-white animate-pulse'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={t.assistant.voiceInput}
            >
              <Mic className="w-3 h-3" />
            </button>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={settings.language === 'ar' ? 'تحدث مع بيب...' : 'Talk to Pip...'}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isBusy || !chatInput.trim()}
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
              aria-label="Send to Pip"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}

      {/* Interactive Canvas Hitbox */}
      <div
        className="pointer-events-auto relative cursor-grab active:cursor-grabbing group"
        onPointerDown={(e) => {
          const sim = simRef.current;
          sim.dragging = true;
          sim.movedDuringDrag = false;
          sim.dragOffsetX = e.clientX - sim.x;
          sim.dragOffsetY = e.clientY - sim.y;
        }}
        onClick={() => {
          if (simRef.current.movedDuringDrag) return;
          playUiSound('jump', settings.soundEnabled, settings.soundVolume);
          simRef.current.vy = -220;
          simRef.current.mood = 'jump';
          simRef.current.moodTimer = 1.4;
          if (!showBubble) {
            setShowBubble(true);
            askMascot('joke');
          } else {
            setShowBubble((prev) => !prev);
          }
        }}
        title={t.mascot.tapHint}
      >
        <canvas ref={canvasRef} className="w-32 h-32 block" />
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center gap-1 -mt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBubble(true);
              askMascot('joke');
            }}
            className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-900/90 dark:bg-slate-800 text-white border border-slate-700 flex items-center gap-1 shadow"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            {t.mascot.jokeBtn}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBubble(true);
              speakText(speechText || t.mascot.defaultGreeting);
            }}
            className="p-1 rounded-md bg-slate-900/90 dark:bg-slate-800 text-white border border-slate-700 shadow"
            aria-label="Speak"
          >
            <Volume2 className="w-3 h-3 text-blue-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
