import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  Gamepad2,
  Download,
  Save,
  Loader2,
  Code2,
  Sliders,
  FileText,
  GitBranch,
  Compass,
  Play,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { GameProject } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

const INITIAL_GAME_PROJECT: GameProject = {
  id: 'starter_ue5_citadel',
  title: 'Solaris Canyon Citadel',
  projectSlug: 'SolarisCanyon',
  dimension: '3D',
  genre: 'Adventure',
  multiplayer: false,
  summary:
    'A third-person Unreal Engine 5 canyon exploration adventure featuring Lumen golden-hour lighting, responsive grappling traversal, and ancient sandstone puzzle mechanisms.',
  gddMarkdown:
    '# Solaris Canyon Citadel — UE5 Design Document\n\n## Core Loop\nTraverse vertical canyon ruins, activate solar mirrors to unlock sealed gates, and uncover lost architectural relics.\n\n## Systems\n- Enhanced Input movement & grapple hook impulse\n- Lumen dynamic global illumination\n- Chaos Physics breakable sandstone pillars',
  ue5WorkflowSteps: [
    '1. Install Unreal Engine 5.4+ via Epic Games Launcher and create a Third Person C++ project named SolarisCanyon.',
    '2. Extract the exported .zip archive and copy the Source/ and Config/ folders into your UE5 project root.',
    '3. Right-click SolarisCanyon.uproject and select "Generate Visual Studio project files" (or Xcode on macOS).',
    '4. Build the project in your IDE, open Unreal Editor, and create Blueprint child classes from ACitadelCharacter.',
    '5. Enable Lumen & Nanite under Project Settings > Rendering as specified in Config/DefaultEngine.ini.',
  ],
  folderStructure: [
    'SolarisCanyon.uproject',
    'Config/DefaultEngine.ini',
    'Source/SolarisCanyon/SolarisCanyon.Build.cs',
    'Source/SolarisCanyon/Public/CitadelCharacter.h',
    'Source/SolarisCanyon/Private/CitadelCharacter.cpp',
    'Content/Blueprints/BP_CitadelCharacter.uasset (create in Editor)',
    'Content/Maps/L_SolarisCanyon.umap (create in Editor)',
  ],
  characterSpec: {
    name: 'Aiden Vance',
    archetype: 'Canyon Pathfinder',
    movementSpeed: 600,
    jumpHeight: 420,
    abilities: ['Grapple Dash', 'Solar Pulse Scan', 'Wall Vault'],
  },
  environmentSpec: {
    biome: 'Red Sandstone Canyon',
    lightingPreset: 'Golden Hour Lumen',
    lumenEnabled: true,
    naniteEnabled: true,
    gravityScale: 1.0,
    audioAmbience: 'Desert Wind & Distant Chimes',
  },
  blueprintNodes: [
    {
      id: 'bp_1',
      blueprintName: 'BP_CitadelCharacter',
      nodeType: 'Event EnhancedInputAction IA_Jump',
      summary: 'Triggers character jump with configurable JumpZVelocity and stamina check.',
      connections: ['Branch (CanJump)', 'Character::Jump'],
    },
    {
      id: 'bp_2',
      blueprintName: 'BP_CitadelCharacter',
      nodeType: 'Function GrappleTrace',
      summary: 'Performs SphereTraceByChannel ahead of camera and launches Character toward anchor.',
      connections: ['LaunchCharacter', 'PlaySoundAtLocation'],
    },
    {
      id: 'bp_3',
      blueprintName: 'BP_SolarGate',
      nodeType: 'Event OnMirrorActivated',
      summary: 'Opens stone gate timeline when all linked solar relays report active.',
      connections: ['Timeline_OpenGate', 'SetActorRelativeLocation'],
    },
  ],
  sourceFiles: [
    {
      path: 'Source/SolarisCanyon/Public/CitadelCharacter.h',
      language: 'cpp',
      code: `#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "CitadelCharacter.generated.h"

UCLASS()
class SOLARISCANYON_API ACitadelCharacter : public ACharacter
{
\tGENERATED_BODY()

public:
\tACitadelCharacter();

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VIP_AI|Movement")
\tfloat BaseMoveSpeed = 600.0f;

\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VIP_AI|Movement")
\tfloat JumpImpulse = 420.0f;

\tUFUNCTION(BlueprintCallable, Category = "VIP_AI|Abilities")
\tvoid TriggerGrappleImpulse(const FVector& TargetPoint);
};`,
    },
    {
      path: 'Source/SolarisCanyon/Private/CitadelCharacter.cpp',
      language: 'cpp',
      code: `#include "CitadelCharacter.h"
#include "GameFramework/CharacterMovementComponent.h"

ACitadelCharacter::ACitadelCharacter()
{
\tGetCharacterMovement()->MaxWalkSpeed = BaseMoveSpeed;
\tGetCharacterMovement()->JumpZVelocity = JumpImpulse;
\tGetCharacterMovement()->GravityScale = 1.0f;
}

void ACitadelCharacter::TriggerGrappleImpulse(const FVector& TargetPoint)
{
\tconst FVector Direction = (TargetPoint - GetActorLocation()).GetSafeNormal();
\tLaunchCharacter(Direction * 1250.0f + FVector(0.0f, 0.0f, 240.0f), true, true);
}`,
    },
    {
      path: 'Config/DefaultEngine.ini',
      language: 'ini',
      code: `[/Script/Engine.RendererSettings]
r.DynamicGlobalIlluminationMethod=1
r.ReflectionMethod=1
r.Nanite=True
r.Lumen.HardwareRayTracing=False
r.DefaultFeature.AutoExposure.ExtendDefaultLuminanceRange=True`,
    },
  ],
  updatedAt: new Date().toISOString(),
};

export function GameCreationView() {
  const {
    t,
    settings,
    gameProjects,
    setGameProjects,
    activeGameId,
    setActiveGameId,
    pendingTemplatePrompt,
    setPendingTemplatePrompt,
    logActivity,
    triggerMascot,
  } = useVip();

  const [mode, setMode] = useState<'nocode' | 'advanced'>('nocode');
  const [activeTab, setActiveTab] = useState<'config' | 'gdd' | 'blueprints' | 'cpp' | 'workflow'>('config');
  const [prompt, setPrompt] = useState('');
  const [dimension, setDimension] = useState<'2D' | '3D'>('3D');
  const [genre, setGenre] = useState('Adventure');
  const [targetPlatform, setTargetPlatform] = useState<'PC' | 'Android' | 'PC & Android'>('PC & Android');
  const [multiplayer, setMultiplayer] = useState(false);

  const [project, setProject] = useState<GameProject>(() => {
    if (activeGameId) {
      const found = gameProjects.find((g) => g.id === activeGameId);
      if (found) return found;
    }
    return gameProjects[0] || INITIAL_GAME_PROJECT;
  });
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);

  // Interactive Sandbox Preview State
  const sandboxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectRef = useRef<GameProject>(project);
  projectRef.current = project;
  const keysRef = useRef<{ left: boolean; right: boolean; jump: boolean }>({
    left: false,
    right: false,
    jump: false,
  });

  useEffect(() => {
    if (activeGameId) {
      const found = gameProjects.find((g) => g.id === activeGameId);
      if (found) {
        setProject(found);
        setDimension(found.dimension);
        setGenre(found.genre);
        if (found.targetPlatform) setTargetPlatform(found.targetPlatform);
      }
    }
  }, [activeGameId, gameProjects]);

  useEffect(() => {
    if (pendingTemplatePrompt?.section === 'game') {
      setPrompt(pendingTemplatePrompt.prompt);
      setPendingTemplatePrompt(null);
    }
  }, [pendingTemplatePrompt, setPendingTemplatePrompt]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'config' || isTypingTarget(e.target)) return;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keysRef.current.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) keysRef.current.right = true;
      if (['ArrowUp', 'KeyW', 'Space'].includes(e.code)) {
        if (e.code === 'Space') e.preventDefault();
        keysRef.current.jump = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keysRef.current.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) keysRef.current.right = false;
      if (['ArrowUp', 'KeyW', 'Space'].includes(e.code)) keysRef.current.jump = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'config') return;
    const canvas = sandboxCanvasRef.current;
    if (!canvas) return;
    let rafId = 0;

    const player = { x: 80, y: 150, vx: 0, vy: 0, onGround: false };
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const cur = projectRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const groundY = h - 36;
      const moveSpeed = Math.max(120, Math.min(480, (cur.characterSpec?.movementSpeed || 600) * 0.4));
      const jumpVel = -Math.max(220, Math.min(540, (cur.characterSpec?.jumpHeight || 420) * 0.85));
      const gravity = 820 * Math.max(0.3, Math.min(2.5, cur.environmentSpec?.gravityScale || 1.0));

      if (keysRef.current.left) player.vx = -moveSpeed;
      else if (keysRef.current.right) player.vx = moveSpeed;
      else player.vx *= 0.8;

      if (keysRef.current.jump && player.onGround) {
        player.vy = jumpVel;
        player.onGround = false;
      }

      player.vy += gravity * dt;
      player.x = Math.max(16, Math.min(w - 36, player.x + player.vx * dt));
      player.y += player.vy * dt;

      const platforms = [
        { x: 150, y: groundY - 52, w: 96, h: 10 },
        { x: 310, y: groundY - 96, w: 110, h: 10 },
      ];
      player.onGround = false;
      for (const p of platforms) {
        if (
          player.vy >= 0 &&
          player.x + 20 > p.x &&
          player.x < p.x + p.w &&
          player.y + 28 >= p.y &&
          player.y + 28 <= p.y + 16
        ) {
          player.y = p.y - 28;
          player.vy = 0;
          player.onGround = true;
        }
      }

      if (player.y + 28 >= groundY) {
        player.y = groundY - 28;
        player.vy = 0;
        player.onGround = true;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        if (cur.environmentSpec?.lumenEnabled) {
          grad.addColorStop(0, '#0F172A');
          grad.addColorStop(0.65, '#312E81');
          grad.addColorStop(1, '#B45309');
        } else {
          grad.addColorStop(0, '#0F172A');
          grad.addColorStop(1, '#1E293B');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        if (cur.dimension === '3D') {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          for (let gx = 0; gx <= w; gx += 40) {
            ctx.beginPath();
            ctx.moveTo(w / 2 + (gx - w / 2) * 0.4, groundY - 45);
            ctx.lineTo(gx, h);
            ctx.stroke();
          }
        }

        ctx.fillStyle = '#334155';
        ctx.fillRect(0, groundY, w, h - groundY);
        ctx.fillStyle = '#F59E0B';
        for (const p of platforms) {
          ctx.fillRect(p.x, p.y, p.w, p.h);
        }

        ctx.fillStyle = '#3B82F6';
        ctx.beginPath();
        ctx.roundRect(player.x, player.y, 20, 28, 6);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(player.x + 12, player.y + 6, 4, 4);

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '11px monospace';
        ctx.fillText(
          `${cur.dimension} | ${cur.genre} | Speed:${cur.characterSpec?.movementSpeed || 600} | G:${(cur.environmentSpec?.gravityScale || 1).toFixed(1)}x | Sandbox Preview`,
          12,
          20
        );
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [activeTab]);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/game/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          dimension,
          genre,
          targetPlatform,
          multiplayer,
          language: settings.language,
          config: {
            movementSpeed: project.characterSpec.movementSpeed,
            gravityScale: project.environmentSpec.gravityScale,
            lumenEnabled: project.environmentSpec.lumenEnabled,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Generation failed.');
        setErrorCode(data.code || null);
        return;
      }

      const raw = data.project || {};
      const generated: GameProject = {
        ...INITIAL_GAME_PROJECT,
        ...raw,
        characterSpec: {
          ...INITIAL_GAME_PROJECT.characterSpec,
          ...(raw.characterSpec || {}),
          abilities: Array.isArray(raw.characterSpec?.abilities) ? raw.characterSpec.abilities : [],
        },
        environmentSpec: {
          ...INITIAL_GAME_PROJECT.environmentSpec,
          ...(raw.environmentSpec || {}),
        },
        ue5WorkflowSteps: Array.isArray(raw.ue5WorkflowSteps) ? raw.ue5WorkflowSteps : [],
        folderStructure: Array.isArray(raw.folderStructure) ? raw.folderStructure : [],
        blueprintNodes: Array.isArray(raw.blueprintNodes) ? raw.blueprintNodes : [],
        sourceFiles: Array.isArray(raw.sourceFiles) && raw.sourceFiles.length > 0 ? raw.sourceFiles : INITIAL_GAME_PROJECT.sourceFiles,
        id: `game_${Date.now()}`,
        dimension,
        genre,
        targetPlatform,
        multiplayer,
        updatedAt: new Date().toISOString(),
      };
      setProject(generated);
      setActiveGameId(generated.id);
      setSelectedFileIdx(0);
      setGameProjects((prev) => [generated, ...prev]);
      logActivity('Generated UE5 Game', `${generated.title} (${targetPlatform})`);
      triggerMascot('celebrate', generated.title);
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveProject = () => {
    const updated = { ...project, targetPlatform, updatedAt: new Date().toISOString() };
    setGameProjects((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
    });
    logActivity('Saved Game Project', updated.title);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 1800);
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  const handleExportZip = async () => {
    const zip = new JSZip();
    zip.file('GDD.md', project.gddMarkdown || project.summary);
    zip.file('ProjectStructure.txt', (project.folderStructure || []).join('\n'));
    zip.file(
      'README_UE5_IMPORT.md',
      `# ${project.title} — Unreal Engine 5 Import Steps\n\n` +
        (project.ue5WorkflowSteps || []).join('\n')
    );
    zip.file(
      'Blueprints/BlueprintSpec.json',
      JSON.stringify(project.blueprintNodes || [], null, 2)
    );
    for (const file of project.sourceFiles || []) {
      zip.file(file.path, file.code);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.projectSlug || 'UE5_Project'}_VIP_AI.zip`;
    a.click();
    URL.revokeObjectURL(url);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  const activeFile = project.sourceFiles?.[selectedFileIdx];

  return (
    <div className="space-y-6">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.game.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t.game.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-lg bg-slate-200/80 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setMode('nocode')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'nocode'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.common.noCode}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('advanced');
                setActiveTab('cpp');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'advanced'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.common.advanced}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveProject}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saveFeedback ? t.common.saved : t.game.saveProject}</span>
          </button>

          <button
            type="button"
            onClick={handleExportZip}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.game.exportZip}</span>
          </button>
        </div>
      </div>

      {/* Natural Language Prompt Builder */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-8 space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.game.promptLabel}
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.game.promptPlaceholder}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="lg:col-span-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t.game.dimension}
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                {(['2D', '3D'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDimension(d);
                      setProject((p) => ({ ...p, dimension: d }));
                    }}
                    className={`py-1.5 rounded text-xs font-semibold ${
                      dimension === d
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t.game.genre}
              </label>
              <select
                value={genre}
                onChange={(e) => {
                  setGenre(e.target.value);
                  setProject((p) => ({ ...p, genre: e.target.value }));
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
              >
                {t.game.genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t.game.platform}
              </label>
              <select
                value={targetPlatform}
                onChange={(e) => {
                  const val = e.target.value as 'PC' | 'Android' | 'PC & Android';
                  setTargetPlatform(val);
                  setProject((p) => ({ ...p, targetPlatform: val }));
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
              >
                <option value="PC & Android">PC &amp; Android (UE5 Cross-Platform)</option>
                <option value="PC">PC (Windows / DirectX 12)</option>
                <option value="Android">Android (Vulkan / Mobile)</option>
              </select>
            </div>

            <div className="col-span-2 flex items-center justify-between gap-2 pt-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiplayer}
                  onChange={(e) => setMultiplayer(e.target.checked)}
                  className="rounded border-slate-400 text-blue-600"
                />
                <span>{t.game.multiplayer}</span>
              </label>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap"
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Gamepad2 className="w-3.5 h-3.5" />
                )}
                <span>{t.game.generateBtn}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
          <span className="px-2.5 py-1 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold">
            {settings.language === 'ar'
              ? '1. مواصفات وأصول مولّدة (GDD / Blueprints)'
              : '1. Generated Assets & Specs (GDD / Blueprints)'}
          </span>
          <span className="px-2.5 py-1 rounded bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
            {settings.language === 'ar'
              ? '2. أكواد مصدر C++ و INI قابلة للتعديل والتصدير'
              : '2. Editable UE5 C++ & INI Source'}
          </span>
          <span className="px-2.5 py-1 rounded bg-amber-600/10 text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
            {settings.language === 'ar'
              ? '3. معاينة فيزياء في المتصفح (التشغيل النهائي داخل UE5)'
              : '3. Browser Physics Sandbox (Compile Native Binary in UE5)'}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
          {t.game.honestNote}
        </p>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      {/* Studio Tabs + Saved Projects Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9 space-y-4">
          <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722]">
            {(
              [
                { id: 'config', icon: Sliders },
                { id: 'gdd', icon: FileText },
                { id: 'blueprints', icon: GitBranch },
                { id: 'cpp', icon: Code2 },
                { id: 'workflow', icon: Compass },
              ] as const
            ).map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.game.tabs[id]}</span>
              </button>
            ))}
          </div>

          {/* Tab 1: Visual Config & Interactive Preview */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                    <Play className="w-4 h-4 text-blue-500" />
                    {t.game.previewTitle}
                  </h3>
                  <span className="text-[11px] text-slate-500">{project.title}</span>
                </div>

                <canvas
                  ref={sandboxCanvasRef}
                  width={560}
                  height={260}
                  className="w-full h-56 rounded-lg border border-slate-800 bg-slate-950 block"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t.game.previewHint}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onPointerDown={() => (keysRef.current.left = true)}
                      onPointerUp={() => (keysRef.current.left = false)}
                      onPointerLeave={() => (keysRef.current.left = false)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onPointerDown={() => (keysRef.current.jump = true)}
                      onPointerUp={() => (keysRef.current.jump = false)}
                      onPointerLeave={() => (keysRef.current.jump = false)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onPointerDown={() => (keysRef.current.right = true)}
                      onPointerUp={() => (keysRef.current.right = false)}
                      onPointerLeave={() => (keysRef.current.right = false)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                  <img
                    src="/src/assets/images/ue5_world_preview_1794851150661.jpg"
                    alt="UE5 Level Concept"
                    referrerPolicy="no-referrer"
                    className="w-full h-36 object-cover"
                  />
                </div>
              </div>

              <div className="md:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-4">
                <h4 className="font-display font-semibold text-sm">{t.game.physics}</h4>
                <div className="space-y-3 text-xs">
                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span>Walk Speed</span>
                      <span className="font-mono tabular-nums">
                        {project.characterSpec.movementSpeed} cm/s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={200}
                      max={1200}
                      step={25}
                      value={project.characterSpec.movementSpeed}
                      onChange={(e) =>
                        setProject((p) => ({
                          ...p,
                          characterSpec: { ...p.characterSpec, movementSpeed: Number(e.target.value) },
                        }))
                      }
                      className="w-full"
                    />
                  </label>

                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span>Jump Z Velocity</span>
                      <span className="font-mono tabular-nums">
                        {project.characterSpec.jumpHeight} cm/s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={200}
                      max={900}
                      step={20}
                      value={project.characterSpec.jumpHeight}
                      onChange={(e) =>
                        setProject((p) => ({
                          ...p,
                          characterSpec: { ...p.characterSpec, jumpHeight: Number(e.target.value) },
                        }))
                      }
                      className="w-full"
                    />
                  </label>

                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span>Gravity Scale</span>
                      <span className="font-mono tabular-nums">
                        {project.environmentSpec.gravityScale.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={2.4}
                      step={0.1}
                      value={project.environmentSpec.gravityScale}
                      onChange={(e) =>
                        setProject((p) => ({
                          ...p,
                          environmentSpec: {
                            ...p.environmentSpec,
                            gravityScale: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full"
                    />
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="font-display font-semibold text-sm">{t.game.lighting}</h4>
                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <span>Lumen Global Illumination</span>
                    <input
                      type="checkbox"
                      checked={project.environmentSpec.lumenEnabled}
                      onChange={(e) =>
                        setProject((p) => ({
                          ...p,
                          environmentSpec: { ...p.environmentSpec, lumenEnabled: e.target.checked },
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <span>Nanite Virtualized Geometry</span>
                    <input
                      type="checkbox"
                      checked={project.environmentSpec.naniteEnabled}
                      onChange={(e) =>
                        setProject((p) => ({
                          ...p,
                          environmentSpec: { ...p.environmentSpec, naniteEnabled: e.target.checked },
                        }))
                      }
                    />
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Audio Cue: {project.environmentSpec.audioAmbience}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: GDD & Folder Structure */}
          {activeTab === 'gdd' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-3">
                <h3 className="font-display font-semibold text-base">{project.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{project.summary}</p>
                <pre className="whitespace-pre-wrap text-xs font-mono bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed">
                  {project.gddMarkdown}
                </pre>
              </div>
              <div className="md:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-3">
                <h4 className="font-display font-semibold text-sm">UE5 Project Tree</h4>
                <ul className="space-y-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  {(project.folderStructure || []).map((f) => (
                    <li key={f} className="truncate">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Tab 3: Blueprint Graph */}
          {activeTab === 'blueprints' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm">
                Unreal Engine Blueprint Node Specifications
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(project.blueprintNodes || []).map((node) => (
                  <div
                    key={node.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 overflow-hidden"
                  >
                    <div className="px-3.5 py-2 bg-blue-600 text-white text-xs font-semibold">
                      {node.blueprintName}
                    </div>
                    <div className="p-3.5 space-y-2 text-xs">
                      <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {node.nodeType}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {node.summary}
                      </p>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-amber-600 dark:text-amber-400">
                        {(node.connections || []).join(' → ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Editable C++ & Config Files */}
          {activeTab === 'cpp' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] overflow-hidden grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-4 border-b md:border-b-0 md:border-e border-slate-200 dark:border-slate-800 p-3 space-y-1">
                {(project.sourceFiles || []).map((file, idx) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedFileIdx(idx)}
                    className={`w-full text-start px-3 py-2 rounded-lg text-xs font-mono truncate transition-colors ${
                      selectedFileIdx === idx
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
              <div className="md:col-span-8 p-4 space-y-2">
                {activeFile && (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono">{activeFile.path}</span>
                      <span>Editable UE5 Source</span>
                    </div>
                    <textarea
                      rows={16}
                      value={activeFile.code}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProject((p) => ({
                          ...p,
                          sourceFiles: p.sourceFiles.map((sf, idx) =>
                            idx === selectedFileIdx ? { ...sf, code: val } : sf
                          ),
                        }));
                      }}
                      dir="ltr"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-950 text-emerald-300 font-mono text-xs p-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab 5: UE5 Import Workflow */}
          {activeTab === 'workflow' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-3">
              <h3 className="font-display font-semibold text-base">
                Unreal Engine 5 Workstation Integration Steps
              </h3>
              <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                {(project.ue5WorkflowSteps || []).map((step, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Saved Projects List */}
        <aside className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h4 className="font-display font-semibold text-sm">{t.game.savedProjects}</h4>
          {gameProjects.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.common.empty}</p>
          ) : (
            <div className="space-y-2">
              {gameProjects.map((gp) => (
                <div
                  key={gp.id}
                  onClick={() => {
                    setProject(gp);
                    setSelectedFileIdx(0);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                    project.id === gp.id
                      ? 'border-blue-500 bg-blue-600/10'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{gp.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {gp.dimension} · {gp.genre}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameProjects((prev) => prev.filter((x) => x.id !== gp.id));
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500"
                    aria-label={t.common.delete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
