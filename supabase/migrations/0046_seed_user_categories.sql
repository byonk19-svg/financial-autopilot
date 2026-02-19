-- Seed default categories and auto-categorization rules for the authenticated user.
-- Call once per user via: SELECT seed_user_categories();

create or replace function public.seed_user_categories(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_cat record;
  v_cat_ids jsonb := '{}'::jsonb;
  v_categories jsonb := '[
    {"key":"payroll_brianna",   "name":"Payroll – Brianna",    "icon":"💰"},
    {"key":"payroll_elaine",    "name":"Payroll – Elaine",     "icon":"💰"},
    {"key":"other_income",      "name":"Other Income",          "icon":"💵"},
    {"key":"groceries",         "name":"Groceries",             "icon":"🛒"},
    {"key":"dining",            "name":"Dining & Restaurants",  "icon":"🍽️"},
    {"key":"streaming",         "name":"Streaming & Apps",      "icon":"📺"},
    {"key":"shopping",          "name":"Shopping",              "icon":"🛍️"},
    {"key":"utilities",         "name":"Utilities & Internet",  "icon":"💡"},
    {"key":"phone",             "name":"Phone",                 "icon":"📱"},
    {"key":"mortgage",          "name":"Mortgage & Housing",    "icon":"🏠"},
    {"key":"auto",              "name":"Auto & Gas",            "icon":"🚗"},
    {"key":"healthcare",        "name":"Healthcare",            "icon":"🏥"},
    {"key":"fertility",         "name":"Fertility – Progyny",   "icon":"🌸"},
    {"key":"pharmacy",          "name":"Pharmacy",              "icon":"💊"},
    {"key":"insurance",         "name":"Insurance",             "icon":"🛡️"},
    {"key":"investing",         "name":"Investing",             "icon":"📈"},
    {"key":"savings_transfer",  "name":"Savings Transfer",      "icon":"🏦"},
    {"key":"credit_payment",    "name":"Credit Card Payment",   "icon":"💳"},
    {"key":"loan_payment",      "name":"Loan Payment",          "icon":"📋"},
    {"key":"childcare",         "name":"Childcare & School",    "icon":"👶"},
    {"key":"pet",               "name":"Pet",                   "icon":"🐾"},
    {"key":"travel",            "name":"Travel",                "icon":"✈️"},
    {"key":"fees",              "name":"Fees & Charges",        "icon":"⚠️"},
    {"key":"cash_atm",          "name":"Cash & ATM",            "icon":"🏧"},
    {"key":"other",             "name":"Other",                 "icon":"📌"}
  ]'::jsonb;
  v_rules jsonb;
  v_inserted_cats int := 0;
  v_inserted_rules int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  -- ── 1. Create categories (skip if already exist by name) ──────────────────
  for v_cat in select * from jsonb_array_elements(v_categories)
  loop
    declare
      v_existing_id uuid;
      v_new_id uuid;
      v_cat_name text := (v_cat.value->>'name');
      v_cat_key  text := (v_cat.value->>'key');
    begin
      select id into v_existing_id
      from public.categories
      where user_id = v_user_id and name = v_cat_name
      limit 1;

      if v_existing_id is null then
        insert into public.categories (user_id, name)
        values (v_user_id, v_cat_name)
        returning id into v_new_id;
        v_cat_ids := v_cat_ids || jsonb_build_object(v_cat_key, v_new_id);
        v_inserted_cats := v_inserted_cats + 1;
      else
        v_cat_ids := v_cat_ids || jsonb_build_object(v_cat_key, v_existing_id);
      end if;
    end;
  end loop;

  -- ── 2. Build merchant rules ────────────────────────────────────────────────
  -- Format: [merchant_pattern, category_key, rule_type]
  -- rule_type: merchant_contains (default) or merchant_exact
  v_rules := jsonb_build_array(
    -- Income — Brianna HCA full-time payroll
    jsonb_build_array('HCA PAYROLL',         'payroll_brianna', 'merchant_contains'),
    jsonb_build_array('HCA INC PAYROLL',     'payroll_brianna', 'merchant_contains'),
    -- Income — Elaine PRN employers
    jsonb_build_array('HMG PAYROLL',         'payroll_elaine',  'merchant_contains'),
    jsonb_build_array('MHTW',                'payroll_elaine',  'merchant_contains'),
    jsonb_build_array('HMWB',                'payroll_elaine',  'merchant_contains'),
    jsonb_build_array('SLTW',                'payroll_elaine',  'merchant_contains'),
    jsonb_build_array('KNW PAYROLL',         'payroll_elaine',  'merchant_contains'),
    jsonb_build_array('FOX PAYROLL',         'payroll_elaine',  'merchant_contains'),
    jsonb_build_array('BPT PAYROLL',         'payroll_elaine',  'merchant_contains'),
    -- Groceries
    jsonb_build_array('HEB',                 'groceries',       'merchant_contains'),
    jsonb_build_array('H-E-B',               'groceries',       'merchant_contains'),
    jsonb_build_array('WM SUPERCENTER',      'groceries',       'merchant_contains'),
    jsonb_build_array('WALMART',             'groceries',       'merchant_contains'),
    jsonb_build_array('KROGER',              'groceries',       'merchant_contains'),
    jsonb_build_array('RANDALLS',            'groceries',       'merchant_contains'),
    jsonb_build_array('WHOLE FOODS',         'groceries',       'merchant_contains'),
    jsonb_build_array('COSTCO',              'groceries',       'merchant_contains'),
    jsonb_build_array('SAMS CLUB',           'groceries',       'merchant_contains'),
    jsonb_build_array('ALDI',                'groceries',       'merchant_contains'),
    jsonb_build_array('SPROUTS',             'groceries',       'merchant_contains'),
    -- Dining
    jsonb_build_array('STARBUCKS',           'dining',          'merchant_contains'),
    jsonb_build_array('MCDONALD',            'dining',          'merchant_contains'),
    jsonb_build_array('CHICK-FIL-A',         'dining',          'merchant_contains'),
    jsonb_build_array('CHICKFILA',           'dining',          'merchant_contains'),
    jsonb_build_array('CHIPOTLE',            'dining',          'merchant_contains'),
    jsonb_build_array('WHATABURGER',         'dining',          'merchant_contains'),
    jsonb_build_array('DOORDASH',            'dining',          'merchant_contains'),
    jsonb_build_array('UBER EATS',           'dining',          'merchant_contains'),
    jsonb_build_array('GRUBHUB',             'dining',          'merchant_contains'),
    jsonb_build_array('DOMINO',              'dining',          'merchant_contains'),
    jsonb_build_array('PIZZA',               'dining',          'merchant_contains'),
    jsonb_build_array('PANDA EXPRESS',       'dining',          'merchant_contains'),
    jsonb_build_array('TACO BELL',           'dining',          'merchant_contains'),
    jsonb_build_array('SUBWAY',              'dining',          'merchant_contains'),
    jsonb_build_array('PANERA',              'dining',          'merchant_contains'),
    -- Streaming & Apps
    jsonb_build_array('HULU',                'streaming',       'merchant_contains'),
    jsonb_build_array('NETFLIX',             'streaming',       'merchant_contains'),
    jsonb_build_array('DISNEY PLUS',         'streaming',       'merchant_contains'),
    jsonb_build_array('DISNEYPLUS',          'streaming',       'merchant_contains'),
    jsonb_build_array('SPOTIFY',             'streaming',       'merchant_contains'),
    jsonb_build_array('APPLE',               'streaming',       'merchant_contains'),
    jsonb_build_array('YOUTUBE PREMIUM',     'streaming',       'merchant_contains'),
    jsonb_build_array('AMAZON PRIME',        'streaming',       'merchant_contains'),
    jsonb_build_array('PEACOCK',             'streaming',       'merchant_contains'),
    jsonb_build_array('PARAMOUNT',           'streaming',       'merchant_contains'),
    jsonb_build_array('MAX ',                'streaming',       'merchant_contains'),
    -- Shopping
    jsonb_build_array('AMAZON',              'shopping',        'merchant_contains'),
    jsonb_build_array('AMZN',                'shopping',        'merchant_contains'),
    jsonb_build_array('TARGET',              'shopping',        'merchant_contains'),
    jsonb_build_array('WAYFAIR',             'shopping',        'merchant_contains'),
    jsonb_build_array('CHEWY',               'shopping',        'merchant_contains'),
    jsonb_build_array('EBAY',                'shopping',        'merchant_contains'),
    -- Utilities & Internet
    jsonb_build_array('COMCAST',             'utilities',       'merchant_contains'),
    jsonb_build_array('XFINITY',             'utilities',       'merchant_contains'),
    jsonb_build_array('CENTERPOINT',         'utilities',       'merchant_contains'),
    jsonb_build_array('RELIANT',             'utilities',       'merchant_contains'),
    jsonb_build_array('TXUCOL',              'utilities',       'merchant_contains'),
    jsonb_build_array('ONCOR',               'utilities',       'merchant_contains'),
    jsonb_build_array('ATMOS',               'utilities',       'merchant_contains'),
    -- Phone
    jsonb_build_array('VERIZON',             'phone',           'merchant_contains'),
    jsonb_build_array('AT&T',                'phone',           'merchant_contains'),
    jsonb_build_array('T-MOBILE',            'phone',           'merchant_contains'),
    jsonb_build_array('TMOBILE',             'phone',           'merchant_contains'),
    -- Auto & Gas
    jsonb_build_array('SHELL',               'auto',            'merchant_contains'),
    jsonb_build_array('CHEVRON',             'auto',            'merchant_contains'),
    jsonb_build_array('EXXON',               'auto',            'merchant_contains'),
    jsonb_build_array('VALERO',              'auto',            'merchant_contains'),
    jsonb_build_array('MURPHY USA',          'auto',            'merchant_contains'),
    jsonb_build_array('BUCEES',              'auto',            'merchant_contains'),
    jsonb_build_array('BUC-EE',              'auto',            'merchant_contains'),
    jsonb_build_array('PARKWAY',             'auto',            'merchant_contains'),
    jsonb_build_array('HONDA',               'auto',            'merchant_contains'),
    jsonb_build_array('GEICO',               'auto',            'merchant_contains'),
    jsonb_build_array('PROGRESSIVE',         'auto',            'merchant_contains'),
    jsonb_build_array('CAR WASH',            'auto',            'merchant_contains'),
    -- Healthcare
    jsonb_build_array('HOUSTON METHODIST',   'healthcare',      'merchant_contains'),
    jsonb_build_array('HCA HOSPITAL',        'healthcare',      'merchant_contains'),
    jsonb_build_array('MEMORIAL HERMANN',    'healthcare',      'merchant_contains'),
    jsonb_build_array('LABCORP',             'healthcare',      'merchant_contains'),
    jsonb_build_array('QUEST DIAG',          'healthcare',      'merchant_contains'),
    jsonb_build_array('URGENT CARE',         'healthcare',      'merchant_contains'),
    jsonb_build_array('DENTAL',              'healthcare',      'merchant_contains'),
    jsonb_build_array('VISION',              'healthcare',      'merchant_contains'),
    jsonb_build_array('OPTUM',               'healthcare',      'merchant_contains'),
    -- Fertility
    jsonb_build_array('PROGYNY',             'fertility',       'merchant_contains'),
    jsonb_build_array('FERTILITY',           'fertility',       'merchant_contains'),
    jsonb_build_array('IVF',                 'fertility',       'merchant_contains'),
    -- Pharmacy
    jsonb_build_array('CVS',                 'pharmacy',        'merchant_contains'),
    jsonb_build_array('WALGREENS',           'pharmacy',        'merchant_contains'),
    jsonb_build_array('WALGREEN',            'pharmacy',        'merchant_contains'),
    jsonb_build_array('PHARMACY',            'pharmacy',        'merchant_contains'),
    jsonb_build_array('RX',                  'pharmacy',        'merchant_contains'),
    -- Investing / Savings
    jsonb_build_array('BETTERMENT',          'investing',       'merchant_contains'),
    jsonb_build_array('FIDELITY',            'investing',       'merchant_contains'),
    jsonb_build_array('VANGUARD',            'investing',       'merchant_contains'),
    jsonb_build_array('SCHWAB',              'investing',       'merchant_contains'),
    jsonb_build_array('ROBINHOOD',           'investing',       'merchant_contains'),
    -- Credit card / loan payments
    jsonb_build_array('DISCOVER E PAYMENT',  'credit_payment',  'merchant_contains'),
    jsonb_build_array('CITI PAYMENT',        'credit_payment',  'merchant_contains'),
    jsonb_build_array('CHASE PAYMENT',       'credit_payment',  'merchant_contains'),
    jsonb_build_array('AUTOPAY',             'credit_payment',  'merchant_contains'),
    jsonb_build_array('ONLINE PAYMENT',      'credit_payment',  'merchant_contains'),
    -- Cash / ATM
    jsonb_build_array('ATM',                 'cash_atm',        'merchant_contains'),
    jsonb_build_array('WITHDRAWAL',          'cash_atm',        'merchant_contains'),
    jsonb_build_array('CASH',                'cash_atm',        'merchant_contains')
  );

  -- ── 3. Insert rules (skip duplicates via unique index) ────────────────────
  declare
    v_rule jsonb;
    v_pattern text;
    v_cat_key text;
    v_rule_type text;
    v_category_id uuid;
  begin
    for v_rule in select * from jsonb_array_elements(v_rules)
    loop
      v_pattern   := v_rule->>0;
      v_cat_key   := v_rule->>1;
      v_rule_type := coalesce(v_rule->>2, 'merchant_contains');
      v_category_id := (v_cat_ids->>v_cat_key)::uuid;

      if v_category_id is null then
        continue; -- skip if category didn't get created (shouldn't happen)
      end if;

      insert into public.transaction_category_rules_v1 (
        user_id, rule_type, merchant_pattern, category_id
      )
      values (
        v_user_id,
        v_rule_type,
        v_pattern,
        v_category_id
      )
      on conflict on constraint uq_transaction_category_rules_v1_signature
      do nothing;

      v_inserted_rules := v_inserted_rules + 1;
    end loop;
  end;

  return jsonb_build_object(
    'categories_created', v_inserted_cats,
    'rules_created', v_inserted_rules,
    'message', 'Default categories and rules seeded successfully.'
  );
end;
$$;

revoke all on function public.seed_user_categories(uuid) from public;
grant execute on function public.seed_user_categories(uuid) to authenticated;
