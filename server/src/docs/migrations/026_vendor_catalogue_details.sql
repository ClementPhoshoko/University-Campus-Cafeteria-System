-- Transactional vendor catalogue configuration. The existing tag, allergen,
-- option-group, and option tables remain the source of truth.

create or replace function public.save_vendor_menu_item_configuration(
  p_vendor_id uuid,
  p_menu_item_id uuid,
  p_actor_id uuid,
  p_dietary_tag_ids uuid[],
  p_allergens jsonb,
  p_option_group_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.menu_items%rowtype;
  v_actor public.vendor_users%rowtype;
  v_old_data jsonb;
  v_new_data jsonb;
  v_allergen jsonb;
  v_allergen_id uuid;
  v_allergen_ids uuid[] := '{}'::uuid[];
  v_notice text;
  v_tag_ids uuid[] := coalesce(p_dietary_tag_ids, '{}'::uuid[]);
  v_group_ids uuid[] := coalesce(p_option_group_ids, '{}'::uuid[]);
begin
  select * into v_actor
    from public.vendor_users
   where vendor_id = p_vendor_id
     and user_id = p_actor_id
     and is_active = true
   for update;
  if not found or v_actor.role <> 'manager'::public.vendor_member_role then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  select * into v_item
    from public.menu_items
   where id = p_menu_item_id and vendor_id = p_vendor_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MENU_ITEM_NOT_FOUND';
  end if;

  if jsonb_typeof(coalesce(p_allergens, '[]'::jsonb)) <> 'array'
     or cardinality(v_tag_ids) > 50
     or cardinality(v_group_ids) > 30
     or jsonb_array_length(coalesce(p_allergens, '[]'::jsonb)) > 50 then
    raise exception using errcode = '22023', message = 'CONFIGURATION_LIMIT_EXCEEDED';
  end if;

  if (select count(distinct id) from unnest(v_tag_ids) as requested_tags(id)) <> cardinality(v_tag_ids) then
    raise exception using errcode = '22023', message = 'DUPLICATE_DIETARY_TAG';
  end if;
  if exists (
    select 1 from unnest(v_tag_ids) as requested(id)
    left join public.dietary_tags tag on tag.id = requested.id and tag.is_active = true
    where tag.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_DIETARY_TAG';
  end if;

  if (select count(distinct id) from unnest(v_group_ids) as requested_groups(id)) <> cardinality(v_group_ids) then
    raise exception using errcode = '22023', message = 'DUPLICATE_OPTION_GROUP';
  end if;
  if exists (
    select 1 from unnest(v_group_ids) as requested(id)
    left join public.option_groups grp on grp.id = requested.id
      and grp.vendor_id = p_vendor_id and grp.is_active = true
    where grp.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_OPTION_GROUP';
  end if;

  for v_allergen in select rows.value from jsonb_array_elements(coalesce(p_allergens, '[]'::jsonb)) as rows(value)
  loop
    if jsonb_typeof(v_allergen) <> 'object' or nullif(v_allergen->>'id', '') is null then
      raise exception using errcode = '22023', message = 'INVALID_ALLERGEN';
    end if;
    v_allergen_id := (v_allergen->>'id')::uuid;
    if v_allergen_id = any(v_allergen_ids) then
      raise exception using errcode = '22023', message = 'DUPLICATE_ALLERGEN';
    end if;
    v_allergen_ids := array_append(v_allergen_ids, v_allergen_id);
    v_notice := nullif(btrim(coalesce(v_allergen->>'vendor_notice', '')), '');
    if v_notice is not null and length(v_notice) > 500 then
      raise exception using errcode = '22023', message = 'ALLERGEN_NOTICE_TOO_LONG';
    end if;
    if not exists (select 1 from public.allergens allergen where allergen.id = v_allergen_id and allergen.is_active = true) then
      raise exception using errcode = 'P0001', message = 'INVALID_ALLERGEN';
    end if;
  end loop;

  select jsonb_build_object(
    'dietary_tag_ids', coalesce((select jsonb_agg(link.dietary_tag_id order by link.dietary_tag_id) from public.menu_item_dietary_tags link where link.menu_item_id = p_menu_item_id), '[]'::jsonb),
    'allergens', coalesce((select jsonb_agg(jsonb_build_object('id', link.allergen_id, 'vendor_notice', link.vendor_notice) order by link.allergen_id) from public.menu_item_allergens link where link.menu_item_id = p_menu_item_id), '[]'::jsonb),
    'option_group_ids', coalesce((select jsonb_agg(link.option_group_id order by link.sort_order, link.option_group_id) from public.menu_item_option_groups link where link.menu_item_id = p_menu_item_id), '[]'::jsonb)
  ) into v_old_data;

  delete from public.menu_item_dietary_tags where menu_item_id = p_menu_item_id;
  insert into public.menu_item_dietary_tags(menu_item_id, dietary_tag_id)
  select p_menu_item_id, distinct_tags.id from (select distinct unnest(v_tag_ids) as id) distinct_tags;

  delete from public.menu_item_allergens where menu_item_id = p_menu_item_id;
  insert into public.menu_item_allergens(menu_item_id, allergen_id, vendor_notice)
  select p_menu_item_id, (entry->>'id')::uuid, nullif(btrim(coalesce(entry->>'vendor_notice', '')), '')
    from jsonb_array_elements(coalesce(p_allergens, '[]'::jsonb)) as entries(entry);

  delete from public.menu_item_option_groups where menu_item_id = p_menu_item_id;
  insert into public.menu_item_option_groups(menu_item_id, option_group_id, sort_order)
  select p_menu_item_id, groups.id, groups.ordinality::integer - 1
    from unnest(v_group_ids) with ordinality as groups(id, ordinality);

  select jsonb_build_object(
    'dietary_tag_ids', coalesce((select jsonb_agg(link.dietary_tag_id order by link.dietary_tag_id) from public.menu_item_dietary_tags link where link.menu_item_id = p_menu_item_id), '[]'::jsonb),
    'allergens', coalesce((select jsonb_agg(jsonb_build_object('id', link.allergen_id, 'vendor_notice', link.vendor_notice) order by link.allergen_id) from public.menu_item_allergens link where link.menu_item_id = p_menu_item_id), '[]'::jsonb),
    'option_group_ids', coalesce((select jsonb_agg(link.option_group_id order by link.sort_order, link.option_group_id) from public.menu_item_option_groups link where link.menu_item_id = p_menu_item_id), '[]'::jsonb)
  ) into v_new_data;

  insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data, reason, category)
  values (p_actor_id, 'UPDATE', 'public.menu_items', p_menu_item_id::text, v_old_data, v_new_data, 'Vendor manager updated item dietary, allergen, and option configuration', 'config');

  return jsonb_build_object('success', true, 'menu_item_id', p_menu_item_id, 'configuration', v_new_data);
end;
$$;

create or replace function public.save_vendor_option_group(
  p_vendor_id uuid,
  p_group_id uuid,
  p_actor_id uuid,
  p_name text,
  p_selection_type text,
  p_is_required boolean,
  p_min_select integer,
  p_max_select integer,
  p_is_active boolean,
  p_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.vendor_users%rowtype;
  v_group public.option_groups%rowtype;
  v_old_data jsonb;
  v_new_data jsonb;
  v_option jsonb;
  v_option_id uuid;
  v_option_name text;
  v_price_delta numeric(12,2);
  v_max_quantity integer;
  v_seen_ids uuid[] := '{}'::uuid[];
  v_option_count integer;
begin
  select * into v_actor
    from public.vendor_users
   where vendor_id = p_vendor_id and user_id = p_actor_id and is_active = true
   for update;
  if not found or v_actor.role <> 'manager'::public.vendor_member_role then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  if p_name is null or length(btrim(p_name)) not between 1 and 100
     or p_selection_type is null or p_selection_type not in ('single', 'multiple')
     or p_is_required is null or p_is_active is null
     or p_min_select is null or p_max_select is null
     or p_min_select < 0 or p_max_select < 1 or p_max_select < p_min_select
     or (p_selection_type = 'single' and p_max_select <> 1)
     or (p_is_required and p_min_select < 1) then
    raise exception using errcode = '22023', message = 'INVALID_OPTION_GROUP';
  end if;

  if p_is_active and (jsonb_typeof(coalesce(p_options, '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(p_options, '[]'::jsonb)) < 1
      or jsonb_array_length(coalesce(p_options, '[]'::jsonb)) > 50) then
    raise exception using errcode = '22023', message = 'INVALID_OPTION_LIST';
  end if;

  if p_group_id is null then
    if not p_is_active then
      raise exception using errcode = '22023', message = 'NEW_OPTION_GROUP_MUST_BE_ACTIVE';
    end if;
    insert into public.option_groups(vendor_id, name, selection_type, is_required, min_select, max_select, is_active)
    values (p_vendor_id, btrim(p_name), p_selection_type::public.option_selection_type, p_is_required, p_min_select, p_max_select, true)
    returning * into v_group;
  else
    select * into v_group from public.option_groups where id = p_group_id and vendor_id = p_vendor_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'OPTION_GROUP_NOT_FOUND';
    end if;
    v_old_data := to_jsonb(v_group) || jsonb_build_object('options', coalesce((select jsonb_agg(to_jsonb(opt) order by opt.name) from public.options opt where opt.option_group_id = p_group_id), '[]'::jsonb));
    update public.option_groups
       set name = btrim(p_name), selection_type = p_selection_type::public.option_selection_type,
           is_required = p_is_required, min_select = p_min_select, max_select = p_max_select,
           is_active = p_is_active
     where id = p_group_id
     returning * into v_group;
  end if;

  if p_is_active then
    if jsonb_array_length(p_options) < p_max_select
       or (p_is_required and jsonb_array_length(p_options) < p_min_select) then
      raise exception using errcode = '22023', message = 'OPTION_GROUP_LIMIT_EXCEEDS_OPTION_COUNT';
    end if;
    for v_option in select value from jsonb_array_elements(p_options)
    loop
      if jsonb_typeof(v_option) <> 'object'
         or nullif(btrim(coalesce(v_option->>'name', '')), '') is null
         or length(btrim(v_option->>'name')) > 100 then
        raise exception using errcode = '22023', message = 'INVALID_OPTION';
      end if;
      v_option_name := btrim(v_option->>'name');
      v_price_delta := coalesce(nullif(v_option->>'price_delta', '')::numeric, 0);
      v_max_quantity := coalesce(nullif(v_option->>'max_quantity', '')::integer, 1);
      if v_price_delta < 0 or v_max_quantity < 1 or v_max_quantity > 99 then
        raise exception using errcode = '22023', message = 'INVALID_OPTION';
      end if;

      if nullif(v_option->>'id', '') is not null then
        v_option_id := (v_option->>'id')::uuid;
        if v_option_id = any(v_seen_ids) then
          raise exception using errcode = '22023', message = 'DUPLICATE_OPTION';
        end if;
        v_seen_ids := array_append(v_seen_ids, v_option_id);
        update public.options
           set name = v_option_name, price_delta = v_price_delta, max_quantity = v_max_quantity, is_active = true
         where id = v_option_id and option_group_id = v_group.id;
        if not found then
          raise exception using errcode = 'P0001', message = 'OPTION_NOT_IN_GROUP';
        end if;
      else
        insert into public.options(option_group_id, name, price_delta, max_quantity, is_active)
        values (v_group.id, v_option_name, v_price_delta, v_max_quantity, true)
        returning id into v_option_id;
        v_seen_ids := array_append(v_seen_ids, v_option_id);
      end if;
    end loop;

    v_option_count := cardinality(v_seen_ids);
    if p_max_select > v_option_count then
      raise exception using errcode = '22023', message = 'OPTION_GROUP_MAX_EXCEEDS_OPTION_COUNT';
    end if;
    if p_is_required and p_min_select > v_option_count then
      raise exception using errcode = '22023', message = 'OPTION_GROUP_MIN_EXCEEDS_OPTION_COUNT';
    end if;

    update public.options set is_active = false
     where option_group_id = v_group.id and not (id = any(v_seen_ids));
  end if;

  select to_jsonb(grp) || jsonb_build_object('options', coalesce((select jsonb_agg(to_jsonb(opt) order by opt.name) from public.options opt where opt.option_group_id = grp.id), '[]'::jsonb))
    into v_new_data from public.option_groups grp where grp.id = v_group.id;
  insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data, reason, category)
  values (p_actor_id, case when p_group_id is null then 'INSERT' else 'UPDATE' end, 'public.option_groups', v_group.id::text,
    v_old_data, v_new_data, 'Vendor manager saved an option group and its options', 'config');

  return jsonb_build_object('success', true, 'option_group', v_new_data);
end;
$$;

revoke all on function public.save_vendor_menu_item_configuration(uuid, uuid, uuid, uuid[], jsonb, uuid[])
  from public, anon, authenticated;
grant execute on function public.save_vendor_menu_item_configuration(uuid, uuid, uuid, uuid[], jsonb, uuid[])
  to service_role;

revoke all on function public.save_vendor_option_group(uuid, uuid, uuid, text, text, boolean, integer, integer, boolean, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_vendor_option_group(uuid, uuid, uuid, text, text, boolean, integer, integer, boolean, jsonb)
  to service_role;
