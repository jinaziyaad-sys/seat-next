import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquare, Send, Sparkles, Database, Copy } from 'lucide-react';
import { useAIOperations } from '@/hooks/useAIOperations';
import { toast } from 'sonner';

interface QueryResult {
  question: string;
  sql: string;
  explanation: string;
  results: any[];
  error?: string;
  tokens_used?: number;
  duration_ms?: number;
}

export function NaturalLanguageAnalyticsTab() {
  const { queryAnalytics, operationsLog, loading } = useAIOperations();
  const [input, setInput] = useState('');
  const [querying, setQuerying] = useState(false);
  const [history, setHistory] = useState<QueryResult[]>([]);

  const exampleQuestions = [
    "Which venue had the most orders this week?",
    "What's the average wait time across all venues?",
    "Show me the top 5 venues by rating",
    "How many orders were placed today?",
    "What's the busiest hour for orders?",
  ];

  const handleQuery = async () => {
    if (!input.trim()) return;
    
    setQuerying(true);
    const result = await queryAnalytics(input.trim());
    setQuerying(false);

    if (result) {
      setHistory(prev => [result, ...prev]);
      setInput('');
    }
  };

  const handleExampleClick = (question: string) => {
    setInput(question);
  };

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    toast.success('SQL copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Natural Language Analytics</h3>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Ask a Question</CardTitle>
          <CardDescription>
            Ask questions about your platform data in plain English
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Which venue had the most orders last week?"
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              disabled={querying}
            />
            <Button onClick={handleQuery} disabled={querying || !input.trim()}>
              {querying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {history.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Try these examples:</p>
              <div className="flex flex-wrap gap-2">
                {exampleQuestions.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleExampleClick(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {history.map((result, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {result.question}
                      </CardTitle>
                      {result.duration_ms && (
                        <CardDescription className="text-xs mt-1">
                          Completed in {result.duration_ms}ms
                          {result.tokens_used && ` • ${result.tokens_used} tokens`}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.explanation && (
                    <p className="text-sm text-muted-foreground">{result.explanation}</p>
                  )}

                  {result.sql && (
                    <div className="relative">
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
                        <code>{result.sql}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1"
                        onClick={() => handleCopySql(result.sql)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {result.error ? (
                    <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                      <p className="font-medium">Query Error</p>
                      <p className="text-xs mt-1">{result.error}</p>
                      <p className="text-xs mt-2 text-muted-foreground">
                        You can copy the SQL above and run it in the{' '}
                        <a 
                          href="https://supabase.com/dashboard/project/cuoqjgahpfymxqrdlzlf/sql/new"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          SQL Editor
                        </a>
                      </p>
                    </div>
                  ) : result.results && result.results.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <div className="bg-muted px-3 py-2 flex items-center gap-2 border-b">
                        <Database className="h-4 w-4" />
                        <span className="text-xs font-medium">
                          {result.results.length} result{result.results.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              {Object.keys(result.results[0]).map((key) => (
                                <th key={key} className="px-3 py-2 text-left font-medium">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.results.slice(0, 10).map((row, j) => (
                              <tr key={j} className="border-t">
                                {Object.values(row).map((value: any, k) => (
                                  <td key={k} className="px-3 py-2">
                                    {value === null ? (
                                      <span className="text-muted-foreground">null</span>
                                    ) : typeof value === 'object' ? (
                                      JSON.stringify(value)
                                    ) : (
                                      String(value)
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.results.length > 10 && (
                          <div className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground text-center border-t">
                            Showing 10 of {result.results.length} results
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No results found
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
