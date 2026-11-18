import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import {
  Box,
  Download,
  Loader2,
  RotateCw,
  Grid,
  Focus,
  Wand2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { ThreeDPartSpec, ThreeDProject } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

const STARTER_3D_TEMPLATES: ThreeDProject[] = [
  {
    id: 'tpl_3d_rover',
    name: 'Ares Explorer Rover',
    category: 'object',
    description: 'Composite 6-part autonomous exploration rover with solar mast, radar dish, and dual axles.',
    updatedAt: new Date().toISOString(),
    parts: [
      { name: 'Chassis Hull', shape: 'box', position: [0, 0.75, 0], rotation: [0, 0, 0], dimensions: [2.1, 0.55, 1.3], color: '#CBD5E1', roughness: 0.35, metalness: 0.7 },
      { name: 'Sensor Deck', shape: 'box', position: [0.45, 1.15, 0], rotation: [0, 0, 0], dimensions: [0.9, 0.25, 0.9], color: '#1E293B', roughness: 0.4, metalness: 0.8 },
      { name: 'Mast Pole', shape: 'cylinder', position: [0.6, 1.65, 0], rotation: [0, 0, 0], dimensions: [0.08, 0.95, 0.08], color: '#64748B', roughness: 0.3, metalness: 0.85 },
      { name: 'Camera Head', shape: 'box', position: [0.65, 2.15, 0], rotation: [0, 0.2, 0], dimensions: [0.35, 0.22, 0.55], color: '#F8FAFC', roughness: 0.3, metalness: 0.4, emissive: '#1D4ED8' },
      { name: 'Solar Wing L', shape: 'box', position: [-0.35, 1.15, -1.05], rotation: [0.22, 0, 0], dimensions: [1.3, 0.06, 0.85], color: '#1D4ED8', roughness: 0.2, metalness: 0.9 },
      { name: 'Solar Wing R', shape: 'box', position: [-0.35, 1.15, 1.05], rotation: [-0.22, 0, 0], dimensions: [1.3, 0.06, 0.85], color: '#1D4ED8', roughness: 0.2, metalness: 0.9 },
      { name: 'Wheel FL', shape: 'cylinder', position: [0.8, 0.35, 0.8], rotation: [Math.PI / 2, 0, 0], dimensions: [0.35, 0.24, 0.35], color: '#0F172A', roughness: 0.85, metalness: 0.1 },
      { name: 'Wheel FR', shape: 'cylinder', position: [0.8, 0.35, -0.8], rotation: [Math.PI / 2, 0, 0], dimensions: [0.35, 0.24, 0.35], color: '#0F172A', roughness: 0.85, metalness: 0.1 },
      { name: 'Wheel RL', shape: 'cylinder', position: [-0.8, 0.35, 0.8], rotation: [Math.PI / 2, 0, 0], dimensions: [0.35, 0.24, 0.35], color: '#0F172A', roughness: 0.85, metalness: 0.1 },
      { name: 'Wheel RR', shape: 'cylinder', position: [-0.8, 0.35, -0.8], rotation: [Math.PI / 2, 0, 0], dimensions: [0.35, 0.24, 0.35], color: '#0F172A', roughness: 0.85, metalness: 0.1 },
    ],
  },
  {
    id: 'tpl_3d_mech',
    name: 'Sentinel Mech Companion',
    category: 'character',
    description: 'Articulated bipedal guardian mech with glowing visor core and shoulder pods.',
    updatedAt: new Date().toISOString(),
    parts: [
      { name: 'Foot L', shape: 'box', position: [-0.45, 0.15, 0.1], rotation: [0, 0, 0], dimensions: [0.42, 0.3, 0.72], color: '#334155', roughness: 0.5, metalness: 0.75 },
      { name: 'Foot R', shape: 'box', position: [0.45, 0.15, 0.1], rotation: [0, 0, 0], dimensions: [0.42, 0.3, 0.72], color: '#334155', roughness: 0.5, metalness: 0.75 },
      { name: 'Leg L', shape: 'cylinder', position: [-0.45, 0.85, 0], rotation: [0, 0, 0], dimensions: [0.16, 1.15, 0.16], color: '#64748B', roughness: 0.35, metalness: 0.8 },
      { name: 'Leg R', shape: 'cylinder', position: [0.45, 0.85, 0], rotation: [0, 0, 0], dimensions: [0.16, 1.15, 0.16], color: '#64748B', roughness: 0.35, metalness: 0.8 },
      { name: 'Torso Core', shape: 'dodecahedron', position: [0, 1.8, 0], rotation: [0, 0, 0], dimensions: [0.85, 0.95, 0.75], color: '#F59E0B', roughness: 0.3, metalness: 0.65 },
      { name: 'Visor Ring', shape: 'torus', position: [0, 2.35, 0.22], rotation: [0, 0, 0], dimensions: [0.28, 0.08, 0.28], color: '#38BDF8', roughness: 0.15, metalness: 0.4, emissive: '#0EA5E9' },
      { name: 'Head Dome', shape: 'sphere', position: [0, 2.42, 0], rotation: [0, 0, 0], dimensions: [0.36, 0.34, 0.36], color: '#E2E8F0', roughness: 0.25, metalness: 0.6 },
      { name: 'Shoulder Pod L', shape: 'cone', position: [-0.92, 2.05, 0], rotation: [0, 0, 0.3], dimensions: [0.32, 0.65, 0.32], color: '#1E293B', roughness: 0.4, metalness: 0.8 },
      { name: 'Shoulder Pod R', shape: 'cone', position: [0.92, 2.05, 0], rotation: [0, 0, -0.3], dimensions: [0.32, 0.65, 0.32], color: '#1E293B', roughness: 0.4, metalness: 0.8 },
    ],
  },
  {
    id: 'tpl_3d_citadel',
    name: 'Desert Solar Archway',
    category: 'environment',
    description: 'Architectural sandstone portal with floating energy beacon for game level grayboxing.',
    updatedAt: new Date().toISOString(),
    parts: [
      { name: 'Plinth Base', shape: 'cylinder', position: [0, 0.2, 0], rotation: [0, 0, 0], dimensions: [2.4, 0.4, 2.4], color: '#78350F', roughness: 0.85, metalness: 0.05 },
      { name: 'Pillar Left', shape: 'box', position: [-1.2, 1.6, 0], rotation: [0, 0, 0], dimensions: [0.55, 2.6, 0.65], color: '#D97706', roughness: 0.78, metalness: 0.1 },
      { name: 'Pillar Right', shape: 'box', position: [1.2, 1.6, 0], rotation: [0, 0, 0], dimensions: [0.55, 2.6, 0.65], color: '#D97706', roughness: 0.78, metalness: 0.1 },
      { name: 'Crown Lintel', shape: 'box', position: [0, 3.05, 0], rotation: [0, 0, 0], dimensions: [3.2, 0.45, 0.8], color: '#B45309', roughness: 0.8, metalness: 0.1 },
      { name: 'Portal Ring', shape: 'torus', position: [0, 1.75, 0], rotation: [0, 0, 0], dimensions: [0.75, 0.09, 0.75], color: '#38BDF8', roughness: 0.2, metalness: 0.8, emissive: '#0284C7' },
      { name: 'Apex Spire', shape: 'cone', position: [0, 3.7, 0], rotation: [0, 0, 0], dimensions: [0.45, 0.9, 0.45], color: '#F59E0B', roughness: 0.3, metalness: 0.75 },
    ],
  },
];

function isSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return /swiftshader|llvmpipe|software/i.test(r);
  } catch {
    return true;
  }
}

function buildGeometryFromPart(part: ThreeDPartSpec): THREE.BufferGeometry {
  const [dx, dy, dz] = part.dimensions || [1, 1, 1];
  const sx = Math.max(0.05, Math.abs(dx || 1));
  const sy = Math.max(0.05, Math.abs(dy || 1));
  const sz = Math.max(0.05, Math.abs(dz || 1));

  switch (part.shape) {
    case 'sphere': {
      const geo = new THREE.SphereGeometry(0.5, 28, 20);
      geo.scale(sx * 2, sy * 2, sz * 2);
      return geo;
    }
    case 'cylinder':
      return new THREE.CylinderGeometry(sx, sx, sy, 24);
    case 'cone':
      return new THREE.ConeGeometry(sx, sy, 24);
    case 'torus':
      return new THREE.TorusGeometry(Math.max(0.15, sx), Math.max(0.04, sy * 0.45), 16, 40);
    case 'dodecahedron': {
      const geo = new THREE.DodecahedronGeometry(0.5, 0);
      geo.scale(sx, sy, sz);
      return geo;
    }
    default:
      return new THREE.BoxGeometry(sx, sy, sz);
  }
}

export function ThreeDCreatorView() {
  const {
    t,
    settings,
    threeDProjects,
    setThreeDProjects,
    activeThreeDId,
    setActiveThreeDId,
    pendingTemplatePrompt,
    setPendingTemplatePrompt,
    logActivity,
    triggerMascot,
  } = useVip();

  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<'object' | 'character' | 'environment'>('object');
  const [activeAsset, setActiveAsset] = useState<ThreeDProject>(() => {
    if (activeThreeDId) {
      const found = threeDProjects.find((p) => p.id === activeThreeDId);
      if (found) return found;
    }
    return threeDProjects[0] || STARTER_3D_TEMPLATES[0];
  });
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const assetGroupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  useEffect(() => {
    if (activeThreeDId) {
      const found = threeDProjects.find((p) => p.id === activeThreeDId);
      if (found) {
        setActiveAsset(found);
        setCategory(found.category);
      }
    }
  }, [activeThreeDId, threeDProjects]);

  useEffect(() => {
    if (pendingTemplatePrompt?.section === 'threeD') {
      setPrompt(pendingTemplatePrompt.prompt);
      setPendingTemplatePrompt(null);
    }
  }, [pendingTemplatePrompt, setPendingTemplatePrompt]);

  // Mount Three.js WebGL Viewport
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const testCanvas = document.createElement('canvas');
    if (!testCanvas.getContext('webgl2') && !testCanvas.getContext('webgl')) {
      setWebglError('WebGL is unavailable in this browser environment.');
      return;
    }

    const soft = isSoftwareGl();
    const width = container.clientWidth || 720;
    const height = container.clientHeight || 440;

    const renderer = new THREE.WebGLRenderer({ antialias: !soft, powerPreference: 'high-performance' });
    renderer.setPixelRatio(soft ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(settings.theme === 'dark' ? '#0B0E14' : '#E2E8F0');

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv);
    scene.environment = envTarget.texture;
    roomEnv.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(4.5, 3.2, 5.4);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 1.2, 0);
    controlsRef.current = controls;

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 8, 6);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const gridHelper = new THREE.GridHelper(16, 24, 0x3b82f6, 0x334155);
    scene.add(gridHelper);

    const group = new THREE.Group();
    scene.add(group);
    assetGroupRef.current = group;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (w > 0 && h > 0) {
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(container);

    let rafId = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      if (autoRotateRef.current && assetGroupRef.current) {
        assetGroupRef.current.rotation.y += dt * 0.45;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [settings.theme]);

  // Rebuild Composite Mesh Group when asset or wireframe changes
  useEffect(() => {
    const group = assetGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children.pop()!;
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    }

    for (const part of activeAsset.parts || []) {
      const geometry = buildGeometryFromPart(part);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(part.color || '#94A3B8'),
        roughness: typeof part.roughness === 'number' ? part.roughness : 0.45,
        metalness: typeof part.metalness === 'number' ? part.metalness : 0.4,
        emissive: new THREE.Color(part.emissive || '#000000'),
        emissiveIntensity: part.emissive && part.emissive !== '#000000' ? 0.85 : 0,
        wireframe,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = part.name || 'Part';
      const [px, py, pz] = part.position || [0, 0, 0];
      const [rx, ry, rz] = part.rotation || [0, 0, 0];
      mesh.position.set(px || 0, py || 0, pz || 0);
      mesh.rotation.set(rx || 0, ry || 0, rz || 0);
      group.add(mesh);
    }
  }, [activeAsset, wireframe]);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/3d/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, category, language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '3D generation failed');
        setErrorCode(data.code || null);
        return;
      }

      const created: ThreeDProject = {
        id: `3d_${Date.now()}`,
        name: data.sceneSpec?.name || prompt.slice(0, 36),
        category,
        description: data.sceneSpec?.description || prompt,
        parts: Array.isArray(data.sceneSpec?.parts) ? data.sceneSpec.parts : [],
        updatedAt: new Date().toISOString(),
      };
      setActiveAsset(created);
      setActiveThreeDId(created.id);
      setThreeDProjects((prev) => [created, ...prev]);
      logActivity('Created 3D Asset', created.name);
      triggerMascot('celebrate', created.name);
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(4.5, 3.2, 5.4);
      controlsRef.current.target.set(0, 1.2, 0);
      controlsRef.current.update();
    }
  };

  const exportGLTF = (binary: boolean) => {
    if (!assetGroupRef.current) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      assetGroupRef.current,
      (result) => {
        const slug = activeAsset.name.replace(/\s+/g, '_');
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${slug}.glb`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${slug}.gltf`;
          a.click();
          URL.revokeObjectURL(url);
        }
        playUiSound('pop', settings.soundEnabled, settings.soundVolume);
      },
      (err) => {
        setErrorMsg(err instanceof Error ? err.message : '3D export failed');
      },
      { binary }
    );
  };

  const exportOBJ = () => {
    if (!assetGroupRef.current) return;
    const exporter = new OBJExporter();
    const objText = exporter.parse(assetGroupRef.current);
    const blob = new Blob([objText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeAsset.name.replace(/\s+/g, '_')}.obj`;
    a.click();
    URL.revokeObjectURL(url);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.threeD.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t.threeD.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportGLTF(true)}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.threeD.exportGlb}</span>
          </button>
          <button
            type="button"
            onClick={() => exportGLTF(false)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.threeD.exportGltf}</span>
          </button>
          <button
            type="button"
            onClick={exportOBJ}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.threeD.exportObj}</span>
          </button>
        </div>
      </div>

      {/* Prompt & Category Generator */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t.threeD.promptPlaceholder}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2.5">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
          >
            {(['object', 'character', 'environment'] as const).map((cat) => (
              <option key={cat} value={cat}>
                {t.threeD.categories[cat]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span>{t.threeD.generateBtn}</span>
          </button>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} onRetry={handleGenerate} />}

      {/* Viewport & Hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-500" />
              <span className="font-display font-semibold text-sm">{activeAsset.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs inline-flex items-center gap-1 ${
                  autoRotate ? 'border-blue-500 bg-blue-600/10 text-blue-500' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{t.threeD.autoRotate}</span>
              </button>
              <button
                type="button"
                onClick={() => setWireframe((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs inline-flex items-center gap-1 ${
                  wireframe ? 'border-blue-500 bg-blue-600/10 text-blue-500' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>{t.threeD.wireframe}</span>
              </button>
              <button
                type="button"
                onClick={resetCamera}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs inline-flex items-center gap-1"
              >
                <Focus className="w-3.5 h-3.5" />
                <span>{t.threeD.resetCam}</span>
              </button>
            </div>
          </div>

          <div className="w-full h-[430px] rounded-xl overflow-hidden border border-slate-800 bg-[#0B0E14]">
            {webglError ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-rose-400 p-6">
                {webglError}
              </div>
            ) : (
              <div ref={mountRef} className="w-full h-full" />
            )}
          </div>
          <p className="text-xs text-slate-500">{activeAsset.description}</p>
        </div>

        {/* Starter Templates & Scene Parts */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-2.5">
            <h3 className="font-display font-semibold text-sm">{t.threeD.presets}</h3>
            <div className="space-y-1.5">
              {[...threeDProjects, ...STARTER_3D_TEMPLATES].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveAsset(item);
                    setActiveThreeDId(item.id);
                    playUiSound('click', settings.soundEnabled, settings.soundVolume);
                  }}
                  className={`w-full text-start px-3 py-2 rounded-lg border text-xs transition-colors ${
                    activeAsset.id === item.id
                      ? 'border-blue-500 bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="truncate">{item.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {item.parts.length} parts · {item.category}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-2.5">
            <h3 className="font-display font-semibold text-sm">{t.threeD.partsTitle}</h3>
            <div className="space-y-1 max-h-56 overflow-y-auto text-xs">
              {activeAsset.parts.map((part, idx) => (
                <div
                  key={`${part.name}_${idx}`}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0 border border-white/20"
                      style={{ backgroundColor: part.color }}
                    />
                    <span className="truncate font-medium">{part.name}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">{part.shape}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
