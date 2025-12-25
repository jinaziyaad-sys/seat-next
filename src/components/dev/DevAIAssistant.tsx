import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, Send, Check, X, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PlatformConfig } from '@/hooks/usePlatformConfig';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ConfigAction[];
  timestamp: Date;
}

interface ConfigAction {
  action: 'update_config' | 'create_announcement' | 'clear_announcement' | 'info';
  key?: string;
  value?: any;
  description?: string;
  confirmationMessage: string;
  executed?: boolean;
}

interface DevAIAssistantProps {
  configs: PlatformConfig[];
  onExecuteAction: (action: ConfigAction) => Promise<boolean>;
}

const EXAMPLE_COMMANDS = [
  "Disable food ordering for maintenance",
  "Increase default prep time to 20 minutes",
  "Show a maintenance warning for tonight",
  "Enable all features",
  "Set max party size to 15",
];

export function DevAIAssistant({ configs, onExecuteAction }: DevAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendCommand = async (command: string) => {
    if (!command.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: command,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build current config context
      const currentConfigs = configs.reduce((acc, c) => {
        acc[c.key] = c.value;
        return acc;
      }, {} as Record<string, any>);

      const { data, error } = await supabase.functions.invoke('dev-ai-control', {
        body: { command, context: { currentConfigs } },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.summary || 'Here are the suggested actions:',
        actions: data.actions || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI control error:', error);
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: 'Failed to process command. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (messageId: string, actionIndex: number) => {
    setExecutingAction(`${messageId}-${actionIndex}`);

    const message = messages.find((m) => m.id === messageId);
    const action = message?.actions?.[actionIndex];

    if (!action) return;

    const success = await onExecuteAction(action);

    if (success) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId && m.actions) {
            const updatedActions = [...m.actions];
            updatedActions[actionIndex] = { ...action, executed: true };
            return { ...m, actions: updatedActions };
          }
          return m;
        })
      );
    }

    setExecutingAction(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCommand(input);
    }
  };

  return (
    <Card className="flex h-[600px] flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Control Assistant
        </CardTitle>
        <CardDescription>
          Use natural language to control platform settings. Ask me to toggle features, update settings, or push announcements.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden">
        {/* Messages */}
        <ScrollArea className="flex-1 rounded-lg border bg-muted/30 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="mb-4 h-12 w-12 opacity-50" />
              <p className="mb-4">Try one of these commands:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_COMMANDS.map((cmd) => (
                  <Button
                    key={cmd}
                    variant="outline"
                    size="sm"
                    onClick={() => sendCommand(cmd)}
                    className="text-xs"
                  >
                    {cmd}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.actions.map((action, idx) => (
                          <div
                            key={idx}
                            className="rounded border bg-background p-2"
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {action.action.replace('_', ' ')}
                              </Badge>
                              {action.key && (
                                <code className="text-xs text-muted-foreground">
                                  {action.key}
                                </code>
                              )}
                            </div>
                            <p className="mb-2 text-xs text-muted-foreground">
                              {action.confirmationMessage}
                            </p>
                            {action.action !== 'info' && (
                              <div className="flex gap-2">
                                {action.executed ? (
                                  <Badge variant="secondary" className="text-xs">
                                    <Check className="mr-1 h-3 w-3" />
                                    Executed
                                  </Badge>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => handleExecuteAction(message.id, idx)}
                                      disabled={executingAction === `${message.id}-${idx}`}
                                      className="h-7 text-xs"
                                    >
                                      {executingAction === `${message.id}-${idx}` ? (
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      ) : (
                                        <Check className="mr-1 h-3 w-3" />
                                      )}
                                      Execute
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      disabled={executingAction !== null}
                                    >
                                      <X className="mr-1 h-3 w-3" />
                                      Skip
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-lg border bg-card p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Ask AI to change settings..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <Button onClick={() => sendCommand(input)} disabled={!input.trim() || loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
