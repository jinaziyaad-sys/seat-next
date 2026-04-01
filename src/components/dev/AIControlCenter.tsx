import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformConfig, Announcement } from '@/hooks/usePlatformConfig';
import { FeatureFlagsPanel } from './FeatureFlagsPanel';
import { AnnouncementsPanel } from './AnnouncementsPanel';
import { DevAIAssistant } from './DevAIAssistant';
import { AIOperationsCenter } from './AIOperationsCenter';
import { Loader2 } from 'lucide-react';

export function AIControlCenter() {
  const { configs, features, announcement, loading, rolloutPercentages, updateConfig, updateRollout } = usePlatformConfig();
  const [activeTab, setActiveTab] = useState('operations');

  const handleToggleFeature = async (key: string, value: boolean) => {
    await updateConfig(key, value);
  };

  const handlePublishAnnouncement = async (ann: Announcement) => {
    if (ann) {
      await updateConfig('announcement.active', ann);
    }
  };

  const handleClearAnnouncement = async () => {
    await updateConfig('announcement.active', 'null');
  };

  const handleExecuteAIAction = async (action: {
    action: string;
    key?: string;
    value?: any;
  }): Promise<boolean> => {
    if (action.action === 'update_config' && action.key) {
      return await updateConfig(action.key, action.value);
    }
    if (action.action === 'create_announcement' && action.value) {
      return await updateConfig('announcement.active', action.value);
    }
    if (action.action === 'clear_announcement') {
      return await updateConfig('announcement.active', 'null');
    }
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="operations">AI Operations</TabsTrigger>
          <TabsTrigger value="ai">Config Assistant</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="operations">
          <AIOperationsCenter />
        </TabsContent>

        <TabsContent value="ai">
          <DevAIAssistant configs={configs} onExecuteAction={handleExecuteAIAction} />
        </TabsContent>

        <TabsContent value="features">
          <FeatureFlagsPanel
            features={features}
            loading={loading}
            onToggle={handleToggleFeature}
          />
        </TabsContent>

        <TabsContent value="announcements">
          <AnnouncementsPanel
            announcement={announcement}
            loading={loading}
            onPublish={handlePublishAnnouncement}
            onClear={handleClearAnnouncement}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}