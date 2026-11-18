export type NavSection =
  | 'home'
  | 'assistant'
  | 'developer'
  | 'game'
  | 'image'
  | 'video'
  | 'threeD'
  | 'audio'
  | 'programming'
  | 'pcAssistant'
  | 'vipBrowser'
  | 'presentations'
  | 'documents'
  | 'translator'
  | 'academy'
  | 'automation'
  | 'websiteCreator'
  | 'dataAnalyst'
  | 'ideaGenerator'
  | 'multiAgent'
  | 'chess'
  | 'projects'
  | 'templates'
  | 'settings';

export type Language = 'en' | 'ar';
export type ThemeMode = 'dark' | 'light';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  data?: string;
  textContent?: string;
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  mode: 'general' | 'explain' | 'project';
  messages: ChatMessage[];
  updatedAt: string;
}

export interface DevProjectFile {
  path: string;
  language: string;
  content: string;
}

export interface DevTestCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface DevTestReport {
  ranAt: string;
  passed: boolean;
  checks: DevTestCheck[];
}

export interface DevProjectVersion {
  versionId: string;
  label: string;
  createdAt: string;
  previewHtml: string;
  files: DevProjectFile[];
  summary: string;
}

export interface DevProject {
  id: string;
  name: string;
  targetType: 'webapp' | 'mobile_pwa' | 'fullstack_api';
  summary: string;
  architectureNotes: string;
  previewHtml: string;
  files: DevProjectFile[];
  status: 'draft' | 'tested_verified' | 'needs_repair';
  lastTestReport?: DevTestReport;
  versions: DevProjectVersion[];
  updatedAt: string;
}

export interface AgentGoalStep {
  id: string;
  stepNumber: number;
  title: string;
  actionType: 'plan' | 'research' | 'design' | 'code' | 'verify' | 'deliver';
  instruction: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
}

export interface AgentGoalTask {
  id: string;
  goal: string;
  title: string;
  summary: string;
  status: 'planned' | 'running' | 'completed' | 'failed';
  steps: AgentGoalStep[];
  createdAt: string;
  updatedAt: string;
}

export interface GameBlueprintNode {
  id: string;
  blueprintName: string;
  nodeType: string;
  summary: string;
  connections: string[];
}

export interface GameSourceFile {
  path: string;
  language: string;
  code: string;
}

export interface GameProject {
  id: string;
  title: string;
  projectSlug: string;
  dimension: '2D' | '3D';
  genre: string;
  targetPlatform?: 'PC' | 'Android' | 'PC & Android';
  multiplayer: boolean;
  summary: string;
  gddMarkdown: string;
  ue5WorkflowSteps: string[];
  folderStructure: string[];
  characterSpec: {
    name: string;
    archetype: string;
    movementSpeed: number;
    jumpHeight: number;
    abilities: string[];
  };
  environmentSpec: {
    biome: string;
    lightingPreset: string;
    lumenEnabled: boolean;
    naniteEnabled: boolean;
    gravityScale: number;
    audioAmbience: string;
  };
  blueprintNodes: GameBlueprintNode[];
  sourceFiles: GameSourceFile[];
  updatedAt: string;
}

export interface ImageHistoryItem {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  quality: string;
  imageDataUrl: string;
  createdAt: string;
}

export interface StoryboardScene {
  sceneNumber: number;
  startSec: number;
  endSec: number;
  visualPrompt: string;
  cameraMotion: string;
  transition?: string;
  subtitleText: string;
}

export interface VideoProject {
  id: string;
  title: string;
  style: string;
  transition?: string;
  voiceoverScript: string;
  scenes: StoryboardScene[];
  videoDataUrl?: string;
  audioDataUrl?: string;
  sfxDataUrl?: string;
  createdAt: string;
}

export interface ThreeDPartSpec {
  name: string;
  shape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'dodecahedron' | string;
  position: [number, number, number];
  rotation: [number, number, number];
  dimensions: [number, number, number];
  color: string;
  roughness: number;
  metalness: number;
  emissive?: string;
}

export interface ThreeDProject {
  id: string;
  name: string;
  category: 'object' | 'character' | 'environment';
  description: string;
  parts: ThreeDPartSpec[];
  updatedAt: string;
}

export interface AudioHistoryItem {
  id: string;
  kind: 'tts' | 'sfx' | 'music' | 'transcript';
  title: string;
  audioDataUrl?: string;
  transcript?: string;
  lyrics?: string;
  createdAt: string;
}

export interface CodeProject {
  id: string;
  title: string;
  language: string;
  mainFilename: string;
  mainCode: string;
  explanationMarkdown: string;
  previewHtml?: string;
  files: Array<{ path: string; content: string }>;
  updatedAt: string;
}

export interface PcWorkflowStep {
  stepNumber: number;
  title: string;
  detail: string;
  commandHint?: string;
  requiresConfirmation?: boolean;
}

export interface PcSessionNote {
  id: string;
  title: string;
  osTarget: 'Windows' | 'macOS' | 'Linux' | 'Android';
  query: string;
  summary: string;
  steps: PcWorkflowStep[];
  safetyWarning?: string;
  createdAt: string;
}

export interface BrowserCitation {
  title: string;
  uri: string;
}

export interface BrowserResearchItem {
  id: string;
  query: string;
  url?: string;
  mode: 'search' | 'url';
  summary: string;
  citations: BrowserCitation[];
  createdAt: string;
}

export interface PresentationSlide {
  id: string;
  title: string;
  subtitle?: string;
  layout: 'title' | 'bullets' | 'two-column' | 'quote' | 'closing';
  bullets: string[];
  speakerNotes: string;
  accentColor?: string;
  imagePrompt?: string;
  imageDataUrl?: string;
}

export interface PresentationDeck {
  id: string;
  title: string;
  audience: string;
  themeColor: string;
  slides: PresentationSlide[];
  updatedAt: string;
}

export interface VipDocumentItem {
  id: string;
  title: string;
  sourceType: 'created' | 'docx' | 'pdf' | 'txt';
  content: string;
  summary?: string;
  updatedAt: string;
}

export interface TranslationHistoryItem {
  id: string;
  sourceLang: string;
  targetLang: string;
  tone: string;
  sourceText: string;
  translatedText: string;
  createdAt: string;
}

export interface AcademyQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AcademyLesson {
  id: string;
  topic: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  title: string;
  overview: string;
  sections: Array<{ heading: string; body: string; codeExample?: string }>;
  quiz: AcademyQuizQuestion[];
  exercisePrompt: string;
  starterCode: string;
  completed?: boolean;
  quizScore?: number;
  updatedAt: string;
}

export interface AutomationNode {
  id: string;
  stepOrder: number;
  label: string;
  action: 'web_search' | 'summarize' | 'translate' | 'code_gen' | 'analyze' | 'extract_tasks';
  promptTemplate: string;
  lastOutput?: string;
  status?: 'idle' | 'running' | 'done' | 'error';
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  initialInput: string;
  nodes: AutomationNode[];
  updatedAt: string;
}

export interface WebsiteProject {
  id: string;
  name: string;
  stylePreset: string;
  summary: string;
  previewHtml: string;
  files: DevProjectFile[];
  updatedAt: string;
}

export interface DataColumnProfile {
  name: string;
  type: 'numeric' | 'categorical';
  nonEmptyCount: number;
  missingCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  topValues?: Array<{ label: string; count: number }>;
}

export interface DataAnalysisReport {
  id: string;
  datasetName: string;
  rowCount: number;
  columnCount: number;
  columns: DataColumnProfile[];
  aiInsightsMarkdown: string;
  anomalies: string[];
  recommendations: string[];
  chartLabelCol: string;
  chartValueCol: string;
  updatedAt: string;
}

export interface IdeaPlan {
  id: string;
  seedIdea: string;
  title: string;
  tagline: string;
  valueProposition: string;
  targetAudience: string;
  architectureSpec: string;
  milestones: Array<{ phase: string; goal: string; deliverables: string[] }>;
  risks: string[];
  weekOneSprint: string[];
  launchTarget: 'developer' | 'websiteCreator' | 'presentations' | 'game';
  updatedAt: string;
}

export interface MultiAgentTurn {
  id: string;
  agentRole: 'Researcher' | 'System Architect' | 'Product Designer' | 'Lead Engineer' | 'QA Reviewer';
  summary: string;
  deliverableMarkdown: string;
  createdAt: string;
}

export interface MultiAgentSession {
  id: string;
  objective: string;
  title: string;
  turns: MultiAgentTurn[];
  finalSynthesisMarkdown: string;
  updatedAt: string;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  titleAr: string;
  category: 'webapp' | 'mobile' | 'game' | '3d' | 'video';
  description: string;
  descriptionAr: string;
  targetSection: NavSection;
  promptSeed: string;
}

export interface ActivityLogItem {
  id: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface DashboardWidgetConfig {
  id: NavSection;
  visible: boolean;
  order: number;
}

export interface UserSettings {
  language: Language;
  theme: ThemeMode;
  soundEnabled: boolean;
  soundVolume: number;
  mascotVisible: boolean;
  mascotPatrol: boolean;
  mascotVoice: boolean;
  mascotSpeed: number;
  privacySaveHistory: boolean;
  userName: string;
  userRole: string;
  userAvatar: string;
  dashboardLayout: DashboardWidgetConfig[];
}

export interface MascotSignal {
  type: 'greeting' | 'chat_reaction' | 'chess' | 'joke' | 'celebrate';
  text?: string;
  timestamp: number;
}
