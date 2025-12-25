import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorIntelligenceTab } from './ErrorIntelligenceTab';
import { NaturalLanguageAnalyticsTab } from './NaturalLanguageAnalyticsTab';
import { FeatureRequestsTab } from './FeatureRequestsTab';
import { AlertCircle, MessageSquare, Lightbulb } from 'lucide-react';

export function AIOperationsCenter() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="errors" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Error Intelligence</span>
            <span className="sm:hidden">Errors</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">NL Analytics</span>
            <span className="sm:hidden">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Feature Requests</span>
            <span className="sm:hidden">Features</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="errors">
          <ErrorIntelligenceTab />
        </TabsContent>

        <TabsContent value="analytics">
          <NaturalLanguageAnalyticsTab />
        </TabsContent>

        <TabsContent value="features">
          <FeatureRequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
