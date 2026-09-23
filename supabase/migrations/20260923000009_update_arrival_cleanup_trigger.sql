-- ==============================================================================
-- NERAM PLATFORM: MIGRATION 09 - ARRIVAL CLEANUP TRIGGER & GEOFENCE SUPPORT
-- ==============================================================================
-- 1. Updates cleanup_location_on_participant_leave to trigger on 'ARRIVED' status.
-- 2. Ensures immediate server-side deletion of current_locations when a member arrives.
-- 3. Guarantees zero persistent GPS retention after destination arrival.

CREATE OR REPLACE FUNCTION public.cleanup_location_on_participant_leave()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Purge ephemeral coordinates when participant explicitly leaves OR arrives at destination
    IF (TG_OP = 'UPDATE' AND NEW.status IN ('LEFT', 'ARRIVED') AND OLD.status NOT IN ('LEFT', 'ARRIVED')) THEN
        DELETE FROM public.current_locations
        WHERE session_id = NEW.session_id AND user_id = NEW.user_id;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM public.current_locations
        WHERE session_id = OLD.session_id AND user_id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$;

-- Recreate trigger to ensure updated definition is active
DROP TRIGGER IF EXISTS trg_cleanup_location_on_participant_leave ON public.location_session_participants;
CREATE TRIGGER trg_cleanup_location_on_participant_leave
    AFTER UPDATE OF status OR DELETE ON public.location_session_participants
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_location_on_participant_leave();
