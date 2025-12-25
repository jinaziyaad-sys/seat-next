import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlatformError {
  id: string;
  error_type: string;
  error_message: string;
  stack_trace: string | null;
  component: string | null;
  route: string | null;
  user_id: string | null;
  browser_info: string | null;
  device_info: string | null;
  status: 'new' | 'investigating' | 'resolved' | 'ignored';
  ai_analysis: any | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  created_at: string;
  // New fields for user-reported issues
  source: 'auto' | 'patron' | 'merchant' | null;
  venue_id: string | null;
  venue_name: string | null;
  issue_category: string | null;
}

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'planned' | 'in_progress' | 'completed' | 'rejected';
  source: 'merchant' | 'patron' | 'dev';
  submitter_id: string | null;
  ai_summary: string | null;
  similar_request_ids: string[] | null;
  votes: number;
  created_at: string;
  updated_at: string;
}

export interface AIOperationsLog {
  id: string;
  action_type: string;
  input_data: any;
  output_data: any;
  tokens_used: number | null;
  duration_ms: number | null;
  created_at: string;
}

export function useAIOperations() {
  const [errors, setErrors] = useState<PlatformError[]>([]);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [operationsLog, setOperationsLog] = useState<AIOperationsLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchErrors = useCallback(async () => {
    const { data, error } = await supabase
      .from('platform_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Failed to fetch errors:', error);
      return;
    }
    setErrors(data as PlatformError[] || []);
  }, []);

  const fetchFeatureRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('feature_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Failed to fetch feature requests:', error);
      return;
    }
    setFeatureRequests(data as FeatureRequest[] || []);
  }, []);

  const fetchOperationsLog = useCallback(async () => {
    const { data, error } = await supabase
      .from('ai_operations_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Failed to fetch operations log:', error);
      return;
    }
    setOperationsLog(data as AIOperationsLog[] || []);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchErrors(), fetchFeatureRequests(), fetchOperationsLog()]);
    setLoading(false);
  }, [fetchErrors, fetchFeatureRequests, fetchOperationsLog]);

  useEffect(() => {
    fetchAll();

    // Set up realtime subscriptions
    const errorsChannel = supabase
      .channel('platform_errors_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_errors' }, () => {
        fetchErrors();
      })
      .subscribe();

    const requestsChannel = supabase
      .channel('feature_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_requests' }, () => {
        fetchFeatureRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(errorsChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [fetchAll, fetchErrors, fetchFeatureRequests]);

  const updateErrorStatus = async (errorId: string, status: PlatformError['status']) => {
    const updates: Partial<PlatformError> = { status };
    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('platform_errors')
      .update(updates)
      .eq('id', errorId);

    if (error) {
      toast.error('Failed to update error status');
      return false;
    }
    
    toast.success(`Error marked as ${status}`);
    await fetchErrors();
    return true;
  };

  const analyzeError = async (platformError: PlatformError) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-error-analysis', {
        body: {
          error_id: platformError.id,
          error_type: platformError.error_type,
          error_message: platformError.error_message,
          stack_trace: platformError.stack_trace,
          component: platformError.component,
          route: platformError.route,
          occurrence_count: platformError.occurrence_count,
        },
      });

      if (error) throw error;

      // Update the error with AI analysis
      await supabase
        .from('platform_errors')
        .update({ 
          ai_analysis: { 
            content: data.analysis, 
            analyzed_at: new Date().toISOString() 
          } 
        })
        .eq('id', platformError.id);

      await fetchErrors();
      toast.success('Error analyzed successfully');
      return data.analysis;
    } catch (err) {
      console.error('Error analysis failed:', err);
      toast.error('Failed to analyze error');
      return null;
    }
  };

  const queryAnalytics = async (question: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-analytics-query', {
        body: { question },
      });

      if (error) throw error;
      
      await fetchOperationsLog();
      return data;
    } catch (err) {
      console.error('Analytics query failed:', err);
      toast.error('Failed to query analytics');
      return null;
    }
  };

  const submitFeatureRequest = async (title: string, description: string, source: 'merchant' | 'patron' | 'dev' = 'dev') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke('ai-feature-request', {
        body: {
          title,
          description,
          source,
          submitter_id: user?.id,
        },
      });

      if (error) throw error;
      
      await fetchFeatureRequests();
      toast.success('Feature request submitted and analyzed');
      return data;
    } catch (err) {
      console.error('Feature request failed:', err);
      toast.error('Failed to submit feature request');
      return null;
    }
  };

  const updateFeatureRequestStatus = async (requestId: string, status: FeatureRequest['status']) => {
    const { error } = await supabase
      .from('feature_requests')
      .update({ status })
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to update request status');
      return false;
    }
    
    toast.success(`Request marked as ${status}`);
    await fetchFeatureRequests();
    return true;
  };

  const deleteError = async (errorId: string) => {
    const { error } = await supabase
      .from('platform_errors')
      .delete()
      .eq('id', errorId);

    if (error) {
      toast.error('Failed to delete error');
      return false;
    }
    
    toast.success('Error deleted');
    await fetchErrors();
    return true;
  };

  return {
    errors,
    featureRequests,
    operationsLog,
    loading,
    refetch: fetchAll,
    updateErrorStatus,
    analyzeError,
    queryAnalytics,
    submitFeatureRequest,
    updateFeatureRequestStatus,
    deleteError,
  };
}
