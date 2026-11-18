import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  AcademyLesson,
  ActivityLogItem,
  AgentGoalTask,
  AudioHistoryItem,
  AuthUser,
  AutomationWorkflow,
  BrowserResearchItem,
  CodeProject,
  Conversation,
  DashboardWidgetConfig,
  DataAnalysisReport,
  DevProject,
  GameProject,
  IdeaPlan,
  ImageHistoryItem,
  MascotSignal,
  MultiAgentSession,
  NavSection,
  PcSessionNote,
  PresentationDeck,
  ThreeDProject,
  TranslationHistoryItem,
  UserSettings,
  VideoProject,
  VipDocumentItem,
  WebsiteProject,
} from '../types/vip';
import { translations } from '../i18n/translations';

const LOCAL_STORAGE_KEY = 'vip_ai_workspace_v2';
const AUTH_TOKEN_KEY = 'vip_ai_auth_token';

const DEFAULT_DASHBOARD_LAYOUT: DashboardWidgetConfig[] = [
  { id: 'assistant', visible: true, order: 0 },
  { id: 'developer', visible: true, order: 1 },
  { id: 'multiAgent', visible: true, order: 2 },
  { id: 'game', visible: true, order: 3 },
  { id: 'threeD', visible: true, order: 4 },
  { id: 'websiteCreator', visible: true, order: 5 },
  { id: 'vipBrowser', visible: true, order: 6 },
  { id: 'presentations', visible: true, order: 7 },
  { id: 'documents', visible: true, order: 8 },
  { id: 'translator', visible: true, order: 9 },
  { id: 'academy', visible: true, order: 10 },
  { id: 'automation', visible: true, order: 11 },
  { id: 'dataAnalyst', visible: true, order: 12 },
  { id: 'ideaGenerator', visible: true, order: 13 },
  { id: 'pcAssistant', visible: true, order: 14 },
  { id: 'image', visible: true, order: 15 },
  { id: 'video', visible: true, order: 16 },
  { id: 'audio', visible: true, order: 17 },
  { id: 'programming', visible: true, order: 18 },
  { id: 'chess', visible: true, order: 19 },
  { id: 'projects', visible: true, order: 20 },
  { id: 'templates', visible: true, order: 21 },
  { id: 'settings', visible: true, order: 22 },
];

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  theme: 'dark',
  soundEnabled: true,
  soundVolume: 0.65,
  mascotVisible: true,
  mascotPatrol: true,
  mascotVoice: true,
  mascotSpeed: 1,
  privacySaveHistory: true,
  userName: 'Creative Director',
  userRole: 'AI & Game Architect',
  userAvatar: '/src/assets/images/avatar_creator_profile_1794851150183.jpg',
  dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
};

interface WorkspaceState {
  settings: UserSettings;
  conversations: Conversation[];
  devProjects: DevProject[];
  agentTasks: AgentGoalTask[];
  gameProjects: GameProject[];
  threeDProjects: ThreeDProject[];
  imageHistory: ImageHistoryItem[];
  videoProjects: VideoProject[];
  audioHistory: AudioHistoryItem[];
  codeProjects: CodeProject[];
  pcSessions: PcSessionNote[];
  browserHistory: BrowserResearchItem[];
  presentations: PresentationDeck[];
  documents: VipDocumentItem[];
  translationsHistory: TranslationHistoryItem[];
  academyLessons: AcademyLesson[];
  academyXp: number;
  workflows: AutomationWorkflow[];
  websites: WebsiteProject[];
  dataReports: DataAnalysisReport[];
  ideas: IdeaPlan[];
  multiAgentSessions: MultiAgentSession[];
  recentActivity: ActivityLogItem[];
}

const DEFAULT_STATE: WorkspaceState = {
  settings: DEFAULT_SETTINGS,
  conversations: [],
  devProjects: [],
  agentTasks: [],
  gameProjects: [],
  threeDProjects: [],
  imageHistory: [],
  videoProjects: [],
  audioHistory: [],
  codeProjects: [],
  pcSessions: [],
  browserHistory: [],
  presentations: [],
  documents: [],
  translationsHistory: [],
  academyLessons: [],
  academyXp: 0,
  workflows: [],
  websites: [],
  dataReports: [],
  ideas: [],
  multiAgentSessions: [],
  recentActivity: [],
};

interface VipContextValue extends WorkspaceState {
  activeSection: NavSection;
  setActiveSection: (s: NavSection) => void;
  t: (typeof translations)['en'] | (typeof translations)['ar'];
  isRtl: boolean;
  hydrated: boolean;
  lastSavedAt: string | null;
  authUser: AuthUser | null;
  authToken: string | null;
  setAuthSession: (user: AuthUser | null, token: string | null) => void;
  serverHealth: {
    geminiConfigured: boolean;
    quotas: { freeTierReady: string[]; paidBillingRequired: string[] };
  };
  updateSettings: (patch: Partial<UserSettings>) => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setDevProjects: React.Dispatch<React.SetStateAction<DevProject[]>>;
  setAgentTasks: React.Dispatch<React.SetStateAction<AgentGoalTask[]>>;
  setGameProjects: React.Dispatch<React.SetStateAction<GameProject[]>>;
  setThreeDProjects: React.Dispatch<React.SetStateAction<ThreeDProject[]>>;
  setImageHistory: React.Dispatch<React.SetStateAction<ImageHistoryItem[]>>;
  setVideoProjects: React.Dispatch<React.SetStateAction<VideoProject[]>>;
  setAudioHistory: React.Dispatch<React.SetStateAction<AudioHistoryItem[]>>;
  setCodeProjects: React.Dispatch<React.SetStateAction<CodeProject[]>>;
  setPcSessions: React.Dispatch<React.SetStateAction<PcSessionNote[]>>;
  setBrowserHistory: React.Dispatch<React.SetStateAction<BrowserResearchItem[]>>;
  setPresentations: React.Dispatch<React.SetStateAction<PresentationDeck[]>>;
  setDocuments: React.Dispatch<React.SetStateAction<VipDocumentItem[]>>;
  setTranslationsHistory: React.Dispatch<React.SetStateAction<TranslationHistoryItem[]>>;
  setAcademyLessons: React.Dispatch<React.SetStateAction<AcademyLesson[]>>;
  setAcademyXp: React.Dispatch<React.SetStateAction<number>>;
  setWorkflows: React.Dispatch<React.SetStateAction<AutomationWorkflow[]>>;
  setWebsites: React.Dispatch<React.SetStateAction<WebsiteProject[]>>;
  setDataReports: React.Dispatch<React.SetStateAction<DataAnalysisReport[]>>;
  setIdeas: React.Dispatch<React.SetStateAction<IdeaPlan[]>>;
  setMultiAgentSessions: React.Dispatch<React.SetStateAction<MultiAgentSession[]>>;
  logActivity: (action: string, target: string) => void;
  activeDevId: string | null;
  setActiveDevId: (id: string | null) => void;
  activeGameId: string | null;
  setActiveGameId: (id: string | null) => void;
  activeThreeDId: string | null;
  setActiveThreeDId: (id: string | null) => void;
  pendingTemplatePrompt: { section: NavSection; prompt: string } | null;
  setPendingTemplatePrompt: (p: { section: NavSection; prompt: string } | null) => void;
  clearAllConversations: () => void;
  resetWorkspace: () => Promise<void>;
  restoreWorkspaceBackup: (backup: Partial<WorkspaceState>) => void;
  mascotSignal: MascotSignal | null;
  triggerMascot: (type: MascotSignal['type'], text?: string) => void;
}

const VipContext = createContext<VipContextValue | null>(null);

export function VipProvider({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
  );
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [devProjects, setDevProjects] = useState<DevProject[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentGoalTask[]>([]);
  const [gameProjects, setGameProjects] = useState<GameProject[]>([]);
  const [threeDProjects, setThreeDProjects] = useState<ThreeDProject[]>([]);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [videoProjects, setVideoProjects] = useState<VideoProject[]>([]);
  const [audioHistory, setAudioHistory] = useState<AudioHistoryItem[]>([]);
  const [codeProjects, setCodeProjects] = useState<CodeProject[]>([]);
  const [pcSessions, setPcSessions] = useState<PcSessionNote[]>([]);
  const [browserHistory, setBrowserHistory] = useState<BrowserResearchItem[]>([]);
  const [presentations, setPresentations] = useState<PresentationDeck[]>([]);
  const [documents, setDocuments] = useState<VipDocumentItem[]>([]);
  const [translationsHistory, setTranslationsHistory] = useState<TranslationHistoryItem[]>([]);
  const [academyLessons, setAcademyLessons] = useState<AcademyLesson[]>([]);
  const [academyXp, setAcademyXp] = useState<number>(0);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [websites, setWebsites] = useState<WebsiteProject[]>([]);
  const [dataReports, setDataReports] = useState<DataAnalysisReport[]>([]);
  const [ideas, setIdeas] = useState<IdeaPlan[]>([]);
  const [multiAgentSessions, setMultiAgentSessions] = useState<MultiAgentSession[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLogItem[]>([]);

  const [activeDevId, setActiveDevId] = useState<string | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeThreeDId, setActiveThreeDId] = useState<string | null>(null);
  const [pendingTemplatePrompt, setPendingTemplatePrompt] = useState<{
    section: NavSection;
    prompt: string;
  } | null>(null);

  const [mascotSignal, setMascotSignal] = useState<MascotSignal | null>(null);
  const [serverHealth, setServerHealth] = useState<{
    geminiConfigured: boolean;
    quotas: { freeTierReady: string[]; paidBillingRequired: string[] };
  }>({
    geminiConfigured: false,
    quotas: { freeTierReady: [], paidBillingRequired: [] },
  });

  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.lang = settings.language;
    root.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
  }, [settings.theme, settings.language]);

  const applyWorkspaceSnapshot = useCallback((source: Partial<WorkspaceState>) => {
    if (source.settings) {
      const existingIds = new Set((source.settings.dashboardLayout || []).map((w) => w.id));
      const mergedLayout = [
        ...(source.settings.dashboardLayout || []),
        ...DEFAULT_DASHBOARD_LAYOUT.filter((w) => !existingIds.has(w.id)),
      ];
      setSettings({
        ...DEFAULT_SETTINGS,
        ...source.settings,
        dashboardLayout: mergedLayout,
      });
    }
    if (Array.isArray(source.conversations)) setConversations(source.conversations);
    if (Array.isArray(source.devProjects)) setDevProjects(source.devProjects);
    if (Array.isArray(source.agentTasks)) setAgentTasks(source.agentTasks);
    if (Array.isArray(source.gameProjects)) setGameProjects(source.gameProjects);
    if (Array.isArray(source.threeDProjects)) setThreeDProjects(source.threeDProjects);
    if (Array.isArray(source.imageHistory)) setImageHistory(source.imageHistory);
    if (Array.isArray(source.videoProjects)) setVideoProjects(source.videoProjects);
    if (Array.isArray(source.audioHistory)) setAudioHistory(source.audioHistory);
    if (Array.isArray(source.codeProjects)) setCodeProjects(source.codeProjects);
    if (Array.isArray(source.pcSessions)) setPcSessions(source.pcSessions);
    if (Array.isArray(source.browserHistory)) setBrowserHistory(source.browserHistory);
    if (Array.isArray(source.presentations)) setPresentations(source.presentations);
    if (Array.isArray(source.documents)) setDocuments(source.documents);
    if (Array.isArray(source.translationsHistory)) setTranslationsHistory(source.translationsHistory);
    if (Array.isArray(source.academyLessons)) setAcademyLessons(source.academyLessons);
    if (typeof source.academyXp === 'number') setAcademyXp(source.academyXp);
    if (Array.isArray(source.workflows)) setWorkflows(source.workflows);
    if (Array.isArray(source.websites)) setWebsites(source.websites);
    if (Array.isArray(source.dataReports)) setDataReports(source.dataReports);
    if (Array.isArray(source.ideas)) setIdeas(source.ideas);
    if (Array.isArray(source.multiAgentSessions)) setMultiAgentSessions(source.multiAgentSessions);
    if (Array.isArray(source.recentActivity)) setRecentActivity(source.recentActivity);
  }, []);

  const hydrateFromServer = useCallback(
    async (token: string | null) => {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      let localParsed: Partial<WorkspaceState> | null = null;
      try {
        const rawLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (rawLocal) localParsed = JSON.parse(rawLocal) as Partial<WorkspaceState>;
      } catch {
        localParsed = null;
      }

      const [healthRes, meRes, storeRes] = await Promise.all([
        fetch('/api/health').then((r) => r.json()).catch(() => null),
        token ? fetch('/api/auth/me', { headers }).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
        fetch('/api/store', { headers }).then((r) => r.json()).catch(() => null),
      ]);

      if (healthRes?.ok) {
        setServerHealth({
          geminiConfigured: Boolean(healthRes.geminiConfigured),
          quotas: healthRes.quotas || { freeTierReady: [], paidBillingRequired: [] },
        });
      }
      if (meRes?.user) {
        setAuthUser(meRes.user);
      }

      const remoteData = storeRes?.ok && storeRes.data ? (storeRes.data as Partial<WorkspaceState>) : {};
      const source = Object.keys(remoteData).length > 0 ? remoteData : localParsed || {};
      applyWorkspaceSnapshot(source);
    },
    [applyWorkspaceSnapshot]
  );

  useEffect(() => {
    let mounted = true;
    hydrateFromServer(authToken).finally(() => {
      if (mounted) setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, [authToken, hydrateFromServer]);

  const setAuthSession = useCallback(
    (user: AuthUser | null, token: string | null) => {
      setAuthUser(user);
      setAuthToken(token);
      if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
      else localStorage.removeItem(AUTH_TOKEN_KEY);
      if (user) {
        setSettings((prev) => ({ ...prev, userName: user.name, userRole: user.role }));
      }
    },
    []
  );

  useEffect(() => {
    if (!hydrated) return;

    const payload: WorkspaceState = settings.privacySaveHistory
      ? {
          settings,
          conversations,
          devProjects: devProjects.slice(0, 20),
          agentTasks: agentTasks.slice(0, 20),
          gameProjects: gameProjects.slice(0, 20),
          threeDProjects: threeDProjects.slice(0, 20),
          imageHistory: imageHistory.slice(0, 24),
          videoProjects: videoProjects.slice(0, 16),
          audioHistory: audioHistory.slice(0, 24),
          codeProjects: codeProjects.slice(0, 24),
          pcSessions: pcSessions.slice(0, 24),
          browserHistory: browserHistory.slice(0, 30),
          presentations: presentations.slice(0, 20),
          documents: documents.slice(0, 24),
          translationsHistory: translationsHistory.slice(0, 30),
          academyLessons: academyLessons.slice(0, 20),
          academyXp,
          workflows: workflows.slice(0, 20),
          websites: websites.slice(0, 20),
          dataReports: dataReports.slice(0, 20),
          ideas: ideas.slice(0, 24),
          multiAgentSessions: multiAgentSessions.slice(0, 20),
          recentActivity: recentActivity.slice(0, 40),
        }
      : {
          ...DEFAULT_STATE,
          settings,
        };

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
      setLastSavedAt(new Date().toISOString());
    } catch {
      // Ignore localStorage quota overflow
    }

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      fetch('/api/store', {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.updatedAt) setLastSavedAt(d.updatedAt);
        })
        .catch(() => {});
    }, 500);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [
    hydrated,
    authToken,
    settings,
    conversations,
    devProjects,
    agentTasks,
    gameProjects,
    threeDProjects,
    imageHistory,
    videoProjects,
    audioHistory,
    codeProjects,
    pcSessions,
    browserHistory,
    presentations,
    documents,
    translationsHistory,
    academyLessons,
    academyXp,
    workflows,
    websites,
    dataReports,
    ideas,
    multiAgentSessions,
    recentActivity,
  ]);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const logActivity = useCallback((action: string, target: string) => {
    setRecentActivity((prev) => [
      { id: `act_${Date.now()}`, action, target, timestamp: new Date().toISOString() },
      ...prev.slice(0, 39),
    ]);
  }, []);

  const clearAllConversations = useCallback(() => {
    setConversations([]);
  }, []);

  const restoreWorkspaceBackup = useCallback(
    (backup: Partial<WorkspaceState>) => {
      applyWorkspaceSnapshot(backup);
      logActivity('Restored Workspace Backup', 'JSON Snapshot');
    },
    [applyWorkspaceSnapshot, logActivity]
  );

  const resetWorkspace = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    setConversations([]);
    setDevProjects([]);
    setAgentTasks([]);
    setGameProjects([]);
    setThreeDProjects([]);
    setImageHistory([]);
    setVideoProjects([]);
    setAudioHistory([]);
    setCodeProjects([]);
    setPcSessions([]);
    setBrowserHistory([]);
    setPresentations([]);
    setDocuments([]);
    setTranslationsHistory([]);
    setAcademyLessons([]);
    setAcademyXp(0);
    setWorkflows([]);
    setWebsites([]);
    setDataReports([]);
    setIdeas([]);
    setMultiAgentSessions([]);
    setRecentActivity([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      await fetch('/api/store', { method: 'DELETE', headers });
    } catch {
      // Ignore
    }
  }, [authToken]);

  const triggerMascot = useCallback((type: MascotSignal['type'], text?: string) => {
    setMascotSignal({ type, text, timestamp: Date.now() });
  }, []);

  const t = translations[settings.language];
  const isRtl = settings.language === 'ar';

  return (
    <VipContext.Provider
      value={{
        activeSection,
        setActiveSection,
        t,
        isRtl,
        hydrated,
        lastSavedAt,
        authUser,
        authToken,
        setAuthSession,
        serverHealth,
        settings,
        updateSettings,
        conversations,
        setConversations,
        devProjects,
        setDevProjects,
        agentTasks,
        setAgentTasks,
        gameProjects,
        setGameProjects,
        threeDProjects,
        setThreeDProjects,
        imageHistory,
        setImageHistory,
        videoProjects,
        setVideoProjects,
        audioHistory,
        setAudioHistory,
        codeProjects,
        setCodeProjects,
        pcSessions,
        setPcSessions,
        browserHistory,
        setBrowserHistory,
        presentations,
        setPresentations,
        documents,
        setDocuments,
        translationsHistory,
        setTranslationsHistory,
        academyLessons,
        setAcademyLessons,
        academyXp,
        setAcademyXp,
        workflows,
        setWorkflows,
        websites,
        setWebsites,
        dataReports,
        setDataReports,
        ideas,
        setIdeas,
        multiAgentSessions,
        setMultiAgentSessions,
        recentActivity,
        logActivity,
        activeDevId,
        setActiveDevId,
        activeGameId,
        setActiveGameId,
        activeThreeDId,
        setActiveThreeDId,
        pendingTemplatePrompt,
        setPendingTemplatePrompt,
        clearAllConversations,
        resetWorkspace,
        restoreWorkspaceBackup,
        mascotSignal,
        triggerMascot,
      }}
    >
      {children}
    </VipContext.Provider>
  );
}

export function useVip() {
  const ctx = useContext(VipContext);
  if (!ctx) throw new Error('useVip must be used within VipProvider');
  return ctx;
}
