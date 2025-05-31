-- Create a function to delete a user and all their data
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get the current user ID
  DECLARE user_id uuid;
  
  -- Get the authenticated user's ID
  user_id := auth.uid();
  
  -- Check if user is authenticated
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Delete user's data from all tables with foreign key constraints
  -- Make sure to update this with all tables that contain user data
  DELETE FROM public.notes WHERE user_id = user_id;
  DELETE FROM public.decks WHERE user_id = user_id;
  DELETE FROM public.cards WHERE user_id = user_id;
  DELETE FROM public.user_settings WHERE user_id = user_id;
  
  -- Delete the auth user (this will be handled by Supabase Auth)
  -- The trigger below will handle cleaning up any remaining data
  DELETE FROM auth.users WHERE id = user_id;
  
  -- Note: The actual auth user deletion needs to be handled by the client
  -- using the Supabase Auth API
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Create a trigger to clean up remaining user data after auth user is deleted
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clean up any remaining user data here
  -- This is a fallback in case the delete_user_account function wasn't called
  -- or if there are other tables not covered by it
  
  -- Example:
  -- DELETE FROM public.user_profiles WHERE id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- Note: The following trigger needs to be created in the Supabase dashboard
-- with the service role key as it requires elevated permissions
-- 
-- DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
-- CREATE TRIGGER on_auth_user_deleted
--   AFTER DELETE ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_deleted_user();
