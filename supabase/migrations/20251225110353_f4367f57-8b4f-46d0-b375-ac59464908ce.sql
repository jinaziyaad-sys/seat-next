-- Create a secure function to execute read-only SQL queries
-- Only accessible by super admins for analytics purposes
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  normalized_query TEXT;
BEGIN
  -- Only allow super admins
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: super admin required';
  END IF;

  -- Normalize and validate query
  normalized_query := UPPER(TRIM(query_text));
  
  -- Must start with SELECT
  IF NOT normalized_query LIKE 'SELECT%' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block dangerous patterns
  IF normalized_query ~ '\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|COPY)\s' THEN
    RAISE EXCEPTION 'Dangerous operation not allowed';
  END IF;
  
  -- Block function calls that could be dangerous
  IF normalized_query ~ '\b(PG_SLEEP|PG_TERMINATE|PG_CANCEL|DBLINK|LO_IMPORT|LO_EXPORT)\b' THEN
    RAISE EXCEPTION 'Dangerous function call not allowed';
  END IF;

  -- Execute the query and return results as JSON
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || query_text || ' LIMIT 100) t'
  INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;