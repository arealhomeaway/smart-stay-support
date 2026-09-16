-- Badge evaluation reads canonical counted participation; it never creates time.
CREATE FUNCTION private.owner_badge_actor(_program_id uuid,_actor_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM owner_programs p JOIN property_owners o ON o.id=p.owner_record_id AND o.active
 JOIN auth.users a ON a.id=_actor_id AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
 WHERE p.id=_program_id AND p.archived_at IS NULL AND
 ((p.is_demo AND public.has_role(_actor_id,'admin')) OR (NOT p.is_demo AND (public.is_staff(_actor_id) OR private.owner_program_readable(_actor_id,p.id,false)))))
$$;
REVOKE ALL ON FUNCTION private.owner_badge_actor(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.owner_badge_refresh_version(_program_id uuid,_actor_id uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT private.owner_badge_actor(_program_id,_actor_id) THEN RAISE EXCEPTION 'Badge program access denied'; END IF;
 RETURN (SELECT report_version FROM owner_programs WHERE id=_program_id);
END $$;
REVOKE ALL ON FUNCTION public.owner_badge_refresh_version(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.owner_badge_refresh_version(uuid,uuid) TO service_role;

CREATE FUNCTION private.owner_badge_write_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='owner_program_events' THEN
  IF TG_OP<>'INSERT' AND OLD.kind IN('badge_awarded','badge_flagged','badge_recovered') THEN RAISE EXCEPTION 'Badge history is immutable'; END IF;
  IF TG_OP<>'DELETE' AND NEW.kind IN('badge_awarded','badge_flagged','badge_recovered') AND current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.owner_badges'::regclass)) THEN RAISE EXCEPTION 'Use checked badge history'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.owner_badges'::regclass)) THEN RAISE EXCEPTION 'Use checked canonical badge refresh'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain badge history and flag changed achievements'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.program_id,NEW.code,NEW.awarded_at) IS DISTINCT FROM ROW(OLD.program_id,OLD.code,OLD.awarded_at) THEN RAISE EXCEPTION 'Badge award identity is immutable'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.owner_badge_write_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER owner_badge_write_guard BEFORE INSERT OR UPDATE OR DELETE ON owner_badges FOR EACH ROW EXECUTE FUNCTION private.owner_badge_write_guard();
CREATE TRIGGER owner_badge_event_guard BEFORE INSERT OR UPDATE OR DELETE ON owner_program_events FOR EACH ROW EXECUTE FUNCTION private.owner_badge_write_guard();

CREATE FUNCTION public.refresh_owner_badges(_program_id uuid,_expected_version uuid,_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p owner_programs;b owner_badges;entry_ids uuid[];review_ids uuid[];property_ids uuid[];
 earned text[]:='{}';awarded text[]:='{}';flagged text[]:='{}';recovered text[]:='{}';badge_code text;minutes bigint:=0;
 last_day date;day integer;week integer;week_total numeric;streak integer:=0;best integer:=0;home_id uuid;
 all_participate boolean:=true;all_decide boolean:=true;all_launch boolean:=true;any_launch boolean:=false;
 total_tasks integer;open_tasks integer;decisions integer;launch text;support jsonb;reason text;
 known constant text[]:=ARRAY['first_step','building_momentum','engaged_owner','halfway','strong_finish','hundred_plus','onboarding_champion','decision_maker','consistent_participation','on_track_owner','responsive_partner','property_launch_partner','portfolio_participant','portfolio_decision_maker','portfolio_launch_partner','program_complete'];
BEGIN
 SELECT * INTO p FROM owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _expected_version IS NULL OR p.report_version IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'Participation changed. Refresh before evaluating achievements.'; END IF;
 PERFORM 1 FROM auth.users WHERE id=_actor_id FOR SHARE NOWAIT;
 PERFORM 1 FROM user_roles WHERE user_id=_actor_id FOR SHARE NOWAIT;
 PERFORM 1 FROM property_owners WHERE id=p.owner_record_id FOR SHARE NOWAIT;
 IF NOT private.owner_badge_actor(p.id,_actor_id) THEN RAISE EXCEPTION 'Badge program access denied'; END IF;
 -- Existing input writers also invalidate report_version. NOWAIT avoids waiting
 -- on an older writer that already holds a child lock and needs this program.
 PERFORM 1 FROM owner_program_properties WHERE program_id=p.id ORDER BY property_id FOR SHARE NOWAIT;
 PERFORM 1 FROM properties WHERE id IN(SELECT property_id FROM owner_program_properties WHERE program_id=p.id) ORDER BY id FOR SHARE NOWAIT;
 PERFORM 1 FROM owner_reviews WHERE program_id=p.id ORDER BY id FOR SHARE NOWAIT;
 PERFORM 1 FROM tickets WHERE id IN(SELECT ticket_id FROM owner_reviews WHERE program_id=p.id) ORDER BY id FOR SHARE NOWAIT;
 PERFORM 1 FROM owner_review_properties WHERE review_id IN(SELECT id FROM owner_reviews WHERE program_id=p.id) ORDER BY review_id,property_id FOR SHARE NOWAIT;
 PERFORM 1 FROM owner_time_entries WHERE program_id=p.id ORDER BY id FOR SHARE NOWAIT;
 PERFORM 1 FROM owner_time_entry_properties WHERE entry_id IN(SELECT id FROM owner_time_entries WHERE program_id=p.id) ORDER BY entry_id,property_id FOR SHARE NOWAIT;
 PERFORM 1 FROM owner_badges WHERE program_id=p.id ORDER BY code FOR UPDATE NOWAIT;
 last_day:=least(p.ends_on,p.started_on+89,current_date);
 SELECT coalesce(array_agg(e.id ORDER BY e.id),'{}'),coalesce(sum(e.minutes),0) INTO entry_ids,minutes
 FROM owner_time_entries e WHERE e.program_id=p.id AND e.owner_user_id=p.owner_user_id AND e.is_demo=p.is_demo
 AND p.started_on IS NOT NULL AND e.entry_date BETWEEN p.started_on AND last_day AND e.review_status<>'returned'
 AND NOT EXISTS(SELECT 1 FROM owner_time_entries correction WHERE correction.program_id=p.id AND correction.is_demo=p.is_demo AND correction.owner_user_id=p.owner_user_id AND correction.amends_entry_id=e.id);
 SELECT coalesce(array_agg(h.id ORDER BY h.id),'{}') INTO property_ids FROM owner_program_properties e JOIN properties h ON h.id=e.property_id
 WHERE e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND h.archived_at IS NULL AND e.is_demo=p.is_demo AND h.is_demo=p.is_demo AND h.owner_record_id=p.owner_record_id;
 SELECT coalesce(array_agg(r.id ORDER BY r.id),'{}') INTO review_ids FROM owner_reviews r
 WHERE r.program_id=p.id AND r.is_demo=p.is_demo AND r.archived_at IS NULL AND r.status IN('awaiting_owner','returned','answered','closed') AND (r.available_from IS NULL OR r.available_from<=now())
 AND (r.property_id IS NULL OR r.property_id=ANY(property_ids))
 AND NOT EXISTS(SELECT 1 FROM owner_review_properties l WHERE l.review_id=r.id AND NOT(l.property_id=ANY(property_ids)))
 AND (r.task_type='program_wide' OR r.property_id IS NOT NULL OR EXISTS(SELECT 1 FROM owner_review_properties l WHERE l.review_id=r.id))
 AND (r.ticket_id IS NULL OR EXISTS(SELECT 1 FROM tickets t WHERE t.id=r.ticket_id AND t.is_demo=p.is_demo AND t.property_id=ANY(property_ids) AND (r.property_id=t.property_id OR EXISTS(SELECT 1 FROM owner_review_properties l WHERE l.review_id=r.id AND l.property_id=t.property_id))));
 IF cardinality(entry_ids)>0 THEN earned:=array_append(earned,'first_step'); END IF;
 IF minutes>=600 THEN earned:=array_append(earned,'building_momentum'); END IF;
 IF minutes>=1500 THEN earned:=array_append(earned,'engaged_owner'); END IF;
 IF minutes>=3000 THEN earned:=array_append(earned,'halfway'); END IF;
 IF minutes>=4500 THEN earned:=array_append(earned,'strong_finish'); END IF;
 -- Locked boundary: exactly 6000 minutes (100.0 hours) qualifies.
 IF minutes>=6000 THEN earned:=array_append(earned,'hundred_plus'); END IF;
 IF minutes>=3600 AND EXISTS(SELECT 1 FROM owner_reviews WHERE id=ANY(review_ids) AND phase='onboarding') AND NOT EXISTS(SELECT 1 FROM owner_reviews WHERE id=ANY(review_ids) AND phase='onboarding' AND status NOT IN('answered','closed')) THEN earned:=array_append(earned,'onboarding_champion'); END IF;
 IF EXISTS(SELECT 1 FROM owner_reviews WHERE id=ANY(review_ids) AND status IN('answered','closed') AND nullif(trim(owner_decision),'') IS NOT NULL AND responded_at::date BETWEEN p.started_on AND last_day) THEN earned:=array_append(earned,'decision_maker'); END IF;
 IF (SELECT count(DISTINCT ((entry_date-p.started_on)/7)+1) FROM owner_time_entries WHERE id=ANY(entry_ids))>=3 THEN earned:=array_append(earned,'consistent_participation'); END IF;
 day:=greatest(0,least(90,last_day-p.started_on+1));
 FOR week IN 1..(day/7) LOOP
  SELECT round(coalesce(sum(e.minutes),0)/60.0,2) INTO week_total FROM owner_time_entries e WHERE e.id=ANY(entry_ids) AND e.entry_date<=p.started_on+week*7-1;
  IF week_total>=round(CASE WHEN week*7<=35 THEN 60.0*week*7/35 ELSE 60.0+45.0*(week*7-35)/55 END,2) THEN streak:=streak+1; ELSE streak:=0; END IF;
  best:=greatest(best,streak);
 END LOOP;
 IF best>=3 THEN earned:=array_append(earned,'on_track_owner'); END IF;
 IF (SELECT count(*) FROM owner_reviews WHERE id=ANY(review_ids) AND status IN('answered','closed') AND responded_at::date BETWEEN p.started_on AND last_day AND respond_by IS NOT NULL AND responded_at::date<=respond_by)>=10 THEN earned:=array_append(earned,'responsive_partner'); END IF;
 FOREACH home_id IN ARRAY property_ids LOOP
  SELECT count(*),count(*) FILTER(WHERE status NOT IN('answered','closed')),count(*) FILTER(WHERE status='awaiting_owner') INTO total_tasks,open_tasks,decisions FROM owner_reviews r WHERE r.id=ANY(review_ids) AND (r.property_id=home_id OR EXISTS(SELECT 1 FROM owner_review_properties l WHERE l.review_id=r.id AND l.property_id=home_id));
  SELECT launch_status INTO launch FROM owner_program_properties WHERE program_id=p.id AND property_id=home_id AND archived_at IS NULL;
  all_participate:=all_participate AND EXISTS(SELECT 1 FROM owner_time_entry_properties l WHERE l.entry_id=ANY(entry_ids) AND l.property_id=home_id);
  all_decide:=all_decide AND total_tasks>0 AND decisions=0;
  any_launch:=any_launch OR (launch IN('ready','launched') AND total_tasks>0 AND open_tasks=0);
  all_launch:=all_launch AND launch IN('ready','launched') AND total_tasks>0 AND open_tasks=0;
 END LOOP;
 IF any_launch THEN earned:=array_append(earned,'property_launch_partner'); END IF;
 IF cardinality(property_ids)>1 THEN
  IF all_participate THEN earned:=array_append(earned,'portfolio_participant'); END IF;
  IF all_decide THEN earned:=array_append(earned,'portfolio_decision_maker'); END IF;
  IF all_launch THEN earned:=array_append(earned,'portfolio_launch_partner'); END IF;
 END IF;
 IF p.status IN('completed','complete') AND p.completed_at IS NOT NULL THEN earned:=array_append(earned,'program_complete'); END IF;
 support:=jsonb_build_object('reportedMinutes',minutes,'entryIds',entry_ids,'reviewIds',review_ids,'propertyIds',property_ids,'reportVersion',_expected_version,'evaluatedAt',now(),'startsOn',p.started_on,'endsOn',last_day);
 FOREACH badge_code IN ARRAY known LOOP
  SELECT * INTO b FROM owner_badges WHERE program_id=p.id AND owner_badges.code=badge_code;
  IF badge_code=ANY(earned) AND NOT FOUND THEN
   reason:='Canonical participation meets the '||badge_code||' achievement rule.';
   INSERT INTO owner_badges(program_id,code,trigger_rule,supporting) VALUES(p.id,badge_code,reason,support);
   INSERT INTO owner_program_events(program_id,kind,summary,new_value,reason,actor_id,detail) VALUES(p.id,'badge_awarded','Participation achievement recorded.',badge_code,reason,_actor_id,support);
   awarded:=array_append(awarded,badge_code);
  ELSIF badge_code=ANY(earned) AND b.needs_review THEN
   UPDATE owner_badges SET needs_review=false,review_note=NULL,trigger_rule='Current canonical participation supports this achievement.',supporting=support WHERE program_id=p.id AND owner_badges.code=badge_code;
   INSERT INTO owner_program_events(program_id,kind,summary,new_value,actor_id,detail) VALUES(p.id,'badge_recovered','Participation achievement restored after review.',badge_code,_actor_id,support);
   recovered:=array_append(recovered,badge_code);
  ELSIF NOT(badge_code=ANY(earned)) AND b.program_id IS NOT NULL AND NOT b.needs_review THEN
   UPDATE owner_badges SET needs_review=true,review_note='Current counted participation or required program context no longer supports this achievement.',supporting=support WHERE program_id=p.id AND owner_badges.code=badge_code;
   INSERT INTO owner_program_events(program_id,kind,summary,new_value,actor_id,detail) VALUES(p.id,'badge_flagged','Participation achievement retained for review.',badge_code,_actor_id,support);
   flagged:=array_append(flagged,badge_code);
  END IF;
 END LOOP;
 RETURN jsonb_build_object('awarded',awarded,'flagged',flagged,'recovered',recovered,'reportVersion',(SELECT report_version FROM owner_programs WHERE id=p.id));
END $$;
REVOKE ALL ON FUNCTION public.refresh_owner_badges(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_owner_badges(uuid,uuid,uuid) TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='public.refresh_owner_badges(uuid,uuid,uuid)'::regprocedure AND (NOT p.prosecdef OR p.proowner<>(SELECT relowner FROM pg_class WHERE oid='public.owner_badges'::regclass) OR pg_get_userbyid(p.proowner) IN('anon','authenticated','service_role'))) THEN RAISE EXCEPTION 'Badge refresh requires the trusted badge table owner'; END IF;
END $$;
