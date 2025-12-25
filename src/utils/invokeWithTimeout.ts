import { supabase } from "@/integrations/supabase/client";

export type InvokeWithTimeoutResult<T> = {
  data: T | null;
  error: unknown | null;
  timedOut: boolean;
};

export async function invokeSupabaseFunctionWithTimeout<T>(
  functionName: string,
  body: unknown,
  timeoutMs = 6000,
): Promise<InvokeWithTimeoutResult<T>> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<InvokeWithTimeoutResult<T>>((resolve) => {
    timeoutId = window.setTimeout(() => {
      resolve({
        data: null,
        error: new Error(
          `Edge function "${functionName}" timed out after ${timeoutMs}ms`,
        ),
        timedOut: true,
      });
    }, timeoutMs);
  });

  const invokePromise = supabase.functions
    .invoke(functionName, { body })
    .then(({ data, error }) => ({
      data: (data ?? null) as T | null,
      error: (error ?? null) as unknown | null,
      timedOut: false,
    }))
    .catch((error) => ({ data: null, error, timedOut: false }));

  const result = await Promise.race([timeoutPromise, invokePromise]);

  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }

  return result;
}
