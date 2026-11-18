/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { VipProvider, useVip } from './context/VipContext';
import { AppShell } from './components/AppShell';
import { RubberHoseMascot } from './components/RubberHoseMascot';
import { hideNativeSplash } from './utils/nativeSplash';
import { HomeView } from './views/HomeView';
import { AssistantView } from './views/AssistantView';
import { DeveloperAgentView } from './views/DeveloperAgentView';
import { GameCreationView } from './views/GameCreationView';
import { ImageStudioView } from './views/ImageStudioView';
import { VideoStudioView } from './views/VideoStudioView';
import { ThreeDCreatorView } from './views/ThreeDCreatorView';
import { AudioStudioView } from './views/AudioStudioView';
import { ProgrammingView } from './views/ProgrammingView';
import { PCAssistantView } from './views/PCAssistantView';
import { VipBrowserView } from './views/VipBrowserView';
import { PresentationMakerView } from './views/PresentationMakerView';
import { DocumentsView } from './views/DocumentsView';
import { TranslatorView } from './views/TranslatorView';
import { AcademyView } from './views/AcademyView';
import { AutomationStudioView } from './views/AutomationStudioView';
import { WebsiteCreatorView } from './views/WebsiteCreatorView';
import { DataAnalystView } from './views/DataAnalystView';
import { IdeaGeneratorView } from './views/IdeaGeneratorView';
import { MultiAgentView } from './views/MultiAgentView';
import { ChessView } from './views/ChessView';
import { ProjectManagerView } from './views/ProjectManagerView';
import { TemplateMarketplaceView } from './views/TemplateMarketplaceView';
import { SettingsView } from './views/SettingsView';

function VipWorkspace() {
  const { activeSection } = useVip();

  useEffect(() => {
    void hideNativeSplash(450);
  }, []);

  return (
    <>
      <AppShell>
        {activeSection === 'home' && <HomeView />}
        {activeSection === 'assistant' && <AssistantView />}
        {activeSection === 'developer' && <DeveloperAgentView />}
        {activeSection === 'game' && <GameCreationView />}
        {activeSection === 'image' && <ImageStudioView />}
        {activeSection === 'video' && <VideoStudioView />}
        {activeSection === 'threeD' && <ThreeDCreatorView />}
        {activeSection === 'audio' && <AudioStudioView />}
        {activeSection === 'programming' && <ProgrammingView />}
        {activeSection === 'pcAssistant' && <PCAssistantView />}
        {activeSection === 'vipBrowser' && <VipBrowserView />}
        {activeSection === 'presentations' && <PresentationMakerView />}
        {activeSection === 'documents' && <DocumentsView />}
        {activeSection === 'translator' && <TranslatorView />}
        {activeSection === 'academy' && <AcademyView />}
        {activeSection === 'automation' && <AutomationStudioView />}
        {activeSection === 'websiteCreator' && <WebsiteCreatorView />}
        {activeSection === 'dataAnalyst' && <DataAnalystView />}
        {activeSection === 'ideaGenerator' && <IdeaGeneratorView />}
        {activeSection === 'multiAgent' && <MultiAgentView />}
        {activeSection === 'chess' && <ChessView />}
        {activeSection === 'projects' && <ProjectManagerView />}
        {activeSection === 'templates' && <TemplateMarketplaceView />}
        {activeSection === 'settings' && <SettingsView />}
      </AppShell>
      <RubberHoseMascot />
    </>
  );
}

export default function App() {
  return (
    <VipProvider>
      <VipWorkspace />
    </VipProvider>
  );
}
