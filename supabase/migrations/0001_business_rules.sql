create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table rules (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0), owner text not null,
 purpose text not null, review_due date not null, active_version_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index rules_name_unique on rules(lower(name));
create table rule_versions (
 id uuid primary key default gen_random_uuid(), rule_id uuid not null references rules(id), version integer not null check(version>0),
 definition jsonb not null check(jsonb_typeof(definition)='object'), author text not null, rationale text not null,
 source_id text, source_version integer, source_export jsonb,
 status text not null default 'draft' check(status in ('draft','approved')), approver text, approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(rule_id,version),
 check((status='draft' and approver is null and approved_at is null) or (status='approved' and length(trim(approver))>0 and lower(trim(approver))<>lower(trim(author)) and approved_at is not null))
);
create unique index version_source_unique on rule_versions(source_id,source_version) where source_id is not null;
alter table rules add constraint rules_active_fk foreign key(active_version_id) references rule_versions(id);
create index rules_active_idx on rules(active_version_id);
create table test_cases (
 id uuid primary key default gen_random_uuid(), rule_id uuid not null references rules(id), name text not null,
 input jsonb not null, expected jsonb not null check(jsonb_typeof(expected)='array'), author text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(rule_id,name)
);
create table test_runs (
 id uuid primary key default gen_random_uuid(), version_id uuid not null references rule_versions(id), actor text not null,
 passed boolean not null, results jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index test_runs_version_idx on test_runs(version_id,created_at desc);
create table decisions (
 id uuid primary key default gen_random_uuid(), version_id uuid not null references rule_versions(id), reference text not null,
 input jsonb not null, output jsonb not null, matches jsonb not null, actor text not null,
 personal boolean not null, accuracy_checked date, retain_until date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(not personal or (accuracy_checked is not null and retain_until is not null))
);
create index decisions_version_idx on decisions(version_id,created_at desc);
create index decisions_retention_idx on decisions(retain_until) where personal;
create table exceptions (
 id uuid primary key default gen_random_uuid(), rule_id uuid not null references rules(id), summary text not null,
 owner text not null, due date not null, resolved_at timestamptz, resolution text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((resolved_at is null and resolution is null) or (resolved_at is not null and length(trim(resolution))>0))
);
create index exceptions_rule_idx on exceptions(rule_id);
create index exceptions_due_idx on exceptions(due) where resolved_at is null;
create table audit_events (
 id uuid primary key default gen_random_uuid(), actor text not null, action text not null, subject text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function preserve_version() returns trigger language plpgsql as $$ begin
 if new.definition is distinct from old.definition or new.rule_id<>old.rule_id or new.version<>old.version or new.author<>old.author or new.rationale<>old.rationale or new.source_export is distinct from old.source_export or new.source_id is distinct from old.source_id or new.source_version is distinct from old.source_version then raise exception 'Version content is immutable. Create a revision.'; end if;
 if old.status='approved' then raise exception 'Approved versions are immutable.'; end if;
 return new; end $$;
create trigger preserve_rule_version before update on rule_versions for each row execute function preserve_version();
create function prevent_rewrite() returns trigger language plpgsql as $$ begin raise exception 'Append-only record'; end $$;
create trigger audit_append_only before update or delete on audit_events for each row execute function prevent_rewrite();
create trigger cases_append_only before update or delete on test_cases for each row execute function prevent_rewrite();
create trigger runs_append_only before update or delete on test_runs for each row execute function prevent_rewrite();
create function validate_active_version() returns trigger language plpgsql as $$ begin
 if new.active_version_id is not null and not exists(select 1 from rule_versions where id=new.active_version_id and rule_id=new.id and status='approved') then raise exception 'Active version must belong to this rule and be approved'; end if; return new; end $$;
create trigger active_version_guard before insert or update on rules for each row execute function validate_active_version();
do $$ declare t text; begin foreach t in array array['rules','rule_versions','test_cases','test_runs','decisions','exceptions','audit_events'] loop
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 if t in ('rules','rule_versions','decisions','exceptions') then execute format('create trigger touch before update on %I for each row execute function touch_updated_at()',t); end if;
 end loop; end $$;
create view rule_register with (security_invoker=true) as
select r.id,r.name,r.owner,r.purpose,r.review_due,v.version as active_version,
 (select count(*)::int from rule_versions rv where rv.rule_id=r.id) as versions,
 (select count(*)::int from test_cases tc where tc.rule_id=r.id) as test_cases,
 (select count(*)::int from exceptions e where e.rule_id=r.id and e.resolved_at is null) as open_exceptions
from rules r left join rule_versions v on v.id=r.active_version_id;
create view reviews_due with (security_invoker=true) as select name,owner,review_due,current_date-review_due as days_overdue,active_version,test_cases,open_exceptions from rule_register where review_due<=current_date+14 order by review_due,name;
create view exception_queue with (security_invoker=true) as select e.id,r.name as rule,e.summary,e.owner,e.due,greatest(0,current_date-e.due) as days_overdue from exceptions e join rules r on r.id=e.rule_id where e.resolved_at is null;
create view decision_summary with (security_invoker=true) as
select r.name,v.version,count(d.id)::int as decisions,count(d.id) filter(where jsonb_array_length(d.output)=0)::int as unmatched,
 count(d.id) filter(where d.personal and d.retain_until<current_date)::int as retention_due
from rules r join rule_versions v on v.rule_id=r.id left join decisions d on d.version_id=v.id group by r.name,v.version;
revoke all on rule_register,reviews_due,exception_queue,decision_summary from public;
