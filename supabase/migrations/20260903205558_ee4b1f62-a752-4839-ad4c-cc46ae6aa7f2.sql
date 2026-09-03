-- Legacy playbooks went live before Resolve had contextual matching, so their
-- matcher payload was an empty object. An empty matcher scores zero, which is
-- why a water-leak or no-hot-water ticket never surfaced its playbook. Give the
-- live playbooks the matcher data their drafts already carry.
update playbooks set matcher = '{"categories":["maintenance"],"keywords":["leak","leaking","water","under sink","drip","dripping","flood","burst","overflow","standing water","ceiling"],"priorities":["p1","p2"]}'::jsonb
where id = '11111111-1111-1111-1111-111111111101' and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["safety"],"keywords":["smoke detector","carbon monoxide","co alarm","alarm","chirping","detector","fire","gas smell"]}'::jsonb
where id = '11111111-1111-1111-1111-111111111102' and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["maintenance"],"keywords":["no heat","no cooling","hvac","air conditioning","ac not","furnace","thermostat","too hot","too cold"]}'::jsonb
where id = '11111111-1111-1111-1111-111111111103' and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["maintenance"],"keywords":["fridge","refrigerator","freezer","oven","stove","microwave","dishwasher","washer","dryer","appliance","not cooling","ice maker"]}'::jsonb
where id in ('11111111-1111-1111-1111-111111111104','ec419bac-904b-4f59-b00d-456162700865') and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["access"],"keywords":["locked out","lockout","code not working","keypad","lock","cannot get in","garage","gate","key"]}'::jsonb
where id in ('11111111-1111-1111-1111-111111111105','b098f44c-9711-410f-9e5e-e188c8d813aa') and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["maintenance"],"keywords":["pest","bugs","ants","roach","mice","rodent","wasp","spider","infestation"]}'::jsonb
where id = '11111111-1111-1111-1111-111111111106' and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["cleaning","guest"],"keywords":["not ready","late clean","turnover","missed","arrival","check-in","not guest ready","dirty on arrival"],"priorities":["p1","p2"]}'::jsonb
where id = '9d263a1d-fd5b-4cf8-a969-b93bffbcea9f' and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["vendor","maintenance"],"keywords":["vendor","quote","dispatch","estimate","approval","contractor"]}'::jsonb
where id = '13d7032f-9b55-4f24-8658-6a29fa504f25' and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["maintenance"],"keywords":["no hot water","hot water","water heater","cold shower","lukewarm","pilot light"]}'::jsonb
where id = 'ce90b8bc-b650-4cf4-a2e9-bee033972f22' and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["guest","claims"],"keywords":["compensation","credit","refund","goodwill","discount","make it right","night lost","claim"]}'::jsonb
where id = 'b4232dc5-6c3e-4b53-a450-a794f0d3ab9d' and matcher = '{}'::jsonb;

update playbooks set matcher = '{"categories":["maintenance"],"keywords":["water damage","mold","mildew","after leak","drying","moisture","dehumidifier"]}'::jsonb
where id = '38860868-5617-4aff-95ee-3cec2ea671b8' and matcher = '{}'::jsonb;
