-- Save one item-details section without reloading or overwriting the others.
-- Existing configuration tables and the all-sections RPC remain available.

create or replace function public.save_vendor_menu_item_configuration_section(
  p_vendor_id uuid,
  p_menu_item_id uuid,
  p_actor_id uuid,
  p_section text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.vendor_users%rowtype;
  v_item public.menu_items%rowtype;
  v_old_data jsonb;
  v_new_data jsonb;
  v_tag_ids uuid[] := '{}'::uuid[];
  v_group_ids uuid[] := '{}'::uuid[];
  v_allergen_ids uuid[] := '{}'::uuid[];
  v_allergens jsonb := coalesce(p_payload->'allergens', '[]'::jsonb);
  v_entry jsonb;
  v_id uuid;
  v_notice text;
begin
  select * into v_actor
    from public.vendor_users
   where vendor_id = p_vendor_id and user_id = p_actor_id and is_active = true
   for update;
  if not found or v_actor.role <> 'manager'::public.vendor_member_role then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  select * into v_item from public.menu_items
   where id = p_menu_item_id and vendor_id = p_vendor_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MENU_ITEM_NOT_FOUND';
  end if;

  if p_section = 'dietary' then
    if jsonb_typeof(coalesce(p_payload->'dietary_tag_ids', '[]'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = 'INVALID_DIETARY_TAG_LIST';
    end if;
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_tag_ids
      from jsonb_array_elements_text(coalesce(p_payload->'dietary_tag_ids', '[]'::jsonb)) as tag_values(value);
    if cardinality(v_tag_ids) > 50 then
      raise exception using errcode = '22023', message = 'CONFIGURATION_LIMIT_EXCEEDED';
    end if;
    if (select count(distinct id) from unnest(v_tag_ids) as requested(id)) <> cardinality(v_tag_ids) then
      raise exception using errcode = '22023', message = 'DUPLICATE_DIETARY_TAG';
    end if;
    if exists (
      select 1 from unnest(v_tag_ids) as requested(id)
       left join public.dietary_tags tag on tag.id = requested.id and tag.is_active = true
       where tag.id is null
    ) then raise exception using errcode = 'P0001', message = 'INVALID_DIETARY_TAG'; end if;

    select coalesce(jsonb_agg(link.dietary_tag_id order by link.dietary_tag_id), '[]'::jsonb)
      into v_old_data from public.menu_item_dietary_tags link where link.menu_item_id = p_menu_item_id;
    v_old_data := jsonb_build_object('dietary_tag_ids', v_old_data);
    delete from public.menu_item_dietary_tags where menu_item_id = p_menu_item_id;
    insert into public.menu_item_dietary_tags(menu_item_id, dietary_tag_id)
      select p_menu_item_id, tag_id from unnest(v_tag_ids) as selected(tag_id);
    select coalesce(jsonb_agg(link.dietary_tag_id order by link.dietary_tag_id), '[]'::jsonb)
      into v_new_data from public.menu_item_dietary_tags link where link.menu_item_id = p_menu_item_id;
    v_new_data := jsonb_build_object('dietary_tag_ids', v_new_data);

  elsif p_section = 'allergens' then
    if jsonb_typeof(v_allergens) <> 'array' or jsonb_array_length(v_allergens) > 50 then
      raise exception using errcode = '22023', message = 'CONFIGURATION_LIMIT_EXCEEDED';
    end if;
    for v_entry in select entry.value from jsonb_array_elements(v_allergens) as entry(value)
    loop
      if jsonb_typeof(v_entry) <> 'object' or nullif(v_entry->>'id', '') is null then
        raise exception using errcode = '22023', message = 'INVALID_ALLERGEN';
      end if;
      v_id := (v_entry->>'id')::uuid;
      if v_id = any(v_allergen_ids) then
        raise exception using errcode = '22023', message = 'DUPLICATE_ALLERGEN';
      end if;
      v_allergen_ids := array_append(v_allergen_ids, v_id);
      v_notice := nullif(btrim(coalesce(v_entry->>'vendor_notice', '')), '');
      if v_notice is not null and length(v_notice) > 500 then
        raise exception using errcode = '22023', message = 'ALLERGEN_NOTICE_TOO_LONG';
      end if;
      if not exists (select 1 from public.allergens allergen where allergen.id = v_id and allergen.is_active = true) then
        raise exception using errcode = 'P0001', message = 'INVALID_ALLERGEN';
      end if;
    end loop;

    select coalesce(jsonb_agg(jsonb_build_object('id', link.allergen_id, 'vendor_notice', link.vendor_notice) order by link.allergen_id), '[]'::jsonb)
      into v_old_data from public.menu_item_allergens link where link.menu_item_id = p_menu_item_id;
    v_old_data := jsonb_build_object('allergens', v_old_data);
    delete from public.menu_item_allergens where menu_item_id = p_menu_item_id;
    insert into public.menu_item_allergens(menu_item_id, allergen_id, vendor_notice)
      select p_menu_item_id, (entry.value->>'id')::uuid, nullif(btrim(coalesce(entry.value->>'vendor_notice', '')), '')
        from jsonb_array_elements(v_allergens) as entry(value);
    select coalesce(jsonb_agg(jsonb_build_object('id', link.allergen_id, 'vendor_notice', link.vendor_notice) order by link.allergen_id), '[]'::jsonb)
      into v_new_data from public.menu_item_allergens link where link.menu_item_id = p_menu_item_id;
    v_new_data := jsonb_build_object('allergens', v_new_data);

  elsif p_section = 'options' then
    if jsonb_typeof(coalesce(p_payload->'option_group_ids', '[]'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = 'INVALID_OPTION_GROUP_LIST';
    end if;
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_group_ids
      from jsonb_array_elements_text(coalesce(p_payload->'option_group_ids', '[]'::jsonb)) as option_values(value);
    if cardinality(v_group_ids) > 30 then
      raise exception using errcode = '22023', message = 'CONFIGURATION_LIMIT_EXCEEDED';
    end if;
    if (select count(distinct id) from unnest(v_group_ids) as requested(id)) <> cardinality(v_group_ids) then
      raise exception using errcode = '22023', message = 'DUPLICATE_OPTION_GROUP';
    end if;
    if exists (
      select 1 from unnest(v_group_ids) as requested(id)
       left join public.option_groups grp on grp.id = requested.id and grp.vendor_id = p_vendor_id and grp.is_active = true
       where grp.id is null
    ) then raise exception using errcode = 'P0001', message = 'INVALID_OPTION_GROUP'; end if;

    select coalesce(jsonb_agg(link.option_group_id order by link.sort_order), '[]'::jsonb)
      into v_old_data from public.menu_item_option_groups link where link.menu_item_id = p_menu_item_id;
    v_old_data := jsonb_build_object('option_group_ids', v_old_data);
    delete from public.menu_item_option_groups where menu_item_id = p_menu_item_id;
    insert into public.menu_item_option_groups(menu_item_id, option_group_id, sort_order)
      select p_menu_item_id, selected.group_id, selected.ordinality::integer - 1
        from unnest(v_group_ids) with ordinality as selected(group_id, ordinality);
    select coalesce(jsonb_agg(link.option_group_id order by link.sort_order), '[]'::jsonb)
      into v_new_data from public.menu_item_option_groups link where link.menu_item_id = p_menu_item_id;
    v_new_data := jsonb_build_object('option_group_ids', v_new_data);

  else
    raise exception using errcode = '22023', message = 'INVALID_CONFIGURATION_SECTION';
  end if;

  insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data, reason, category)
  values (p_actor_id, 'UPDATE', 'public.menu_items', p_menu_item_id::text, v_old_data, v_new_data,
    'Vendor manager updated item ' || p_section || ' configuration', 'config');

  return jsonb_build_object('success', true, 'menu_item_id', p_menu_item_id, 'section', p_section, 'configuration', v_new_data);
end;
$$;

revoke all on function public.save_vendor_menu_item_configuration_section(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_vendor_menu_item_configuration_section(uuid, uuid, uuid, text, jsonb)
  to service_role;
