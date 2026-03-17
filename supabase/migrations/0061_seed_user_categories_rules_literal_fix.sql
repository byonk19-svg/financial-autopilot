-- Fix seed_user_categories to avoid Postgres' 100-argument limit in jsonb_build_array.
-- The security behavior from 0060 remains the same: the function always uses auth.uid().

create or replace function public.seed_user_categories(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
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
  v_rules jsonb := '[
    ["HCA PAYROLL", "payroll_brianna", "merchant_contains"],
    ["HCA INC PAYROLL", "payroll_brianna", "merchant_contains"],
    ["HMG PAYROLL", "payroll_elaine", "merchant_contains"],
    ["MHTW", "payroll_elaine", "merchant_contains"],
    ["HMWB", "payroll_elaine", "merchant_contains"],
    ["SLTW", "payroll_elaine", "merchant_contains"],
    ["KNW PAYROLL", "payroll_elaine", "merchant_contains"],
    ["FOX PAYROLL", "payroll_elaine", "merchant_contains"],
    ["BPT PAYROLL", "payroll_elaine", "merchant_contains"],
    ["HEB", "groceries", "merchant_contains"],
    ["H-E-B", "groceries", "merchant_contains"],
    ["WM SUPERCENTER", "groceries", "merchant_contains"],
    ["WALMART", "groceries", "merchant_contains"],
    ["KROGER", "groceries", "merchant_contains"],
    ["RANDALLS", "groceries", "merchant_contains"],
    ["WHOLE FOODS", "groceries", "merchant_contains"],
    ["COSTCO", "groceries", "merchant_contains"],
    ["SAMS CLUB", "groceries", "merchant_contains"],
    ["ALDI", "groceries", "merchant_contains"],
    ["SPROUTS", "groceries", "merchant_contains"],
    ["STARBUCKS", "dining", "merchant_contains"],
    ["MCDONALD", "dining", "merchant_contains"],
    ["CHICK-FIL-A", "dining", "merchant_contains"],
    ["CHICKFILA", "dining", "merchant_contains"],
    ["CHIPOTLE", "dining", "merchant_contains"],
    ["WHATABURGER", "dining", "merchant_contains"],
    ["DOORDASH", "dining", "merchant_contains"],
    ["UBER EATS", "dining", "merchant_contains"],
    ["GRUBHUB", "dining", "merchant_contains"],
    ["DOMINO", "dining", "merchant_contains"],
    ["PIZZA", "dining", "merchant_contains"],
    ["PANDA EXPRESS", "dining", "merchant_contains"],
    ["TACO BELL", "dining", "merchant_contains"],
    ["SUBWAY", "dining", "merchant_contains"],
    ["PANERA", "dining", "merchant_contains"],
    ["HULU", "streaming", "merchant_contains"],
    ["NETFLIX", "streaming", "merchant_contains"],
    ["DISNEY PLUS", "streaming", "merchant_contains"],
    ["DISNEYPLUS", "streaming", "merchant_contains"],
    ["SPOTIFY", "streaming", "merchant_contains"],
    ["APPLE", "streaming", "merchant_contains"],
    ["YOUTUBE PREMIUM", "streaming", "merchant_contains"],
    ["AMAZON PRIME", "streaming", "merchant_contains"],
    ["PEACOCK", "streaming", "merchant_contains"],
    ["PARAMOUNT", "streaming", "merchant_contains"],
    ["MAX ", "streaming", "merchant_contains"],
    ["AMAZON", "shopping", "merchant_contains"],
    ["AMZN", "shopping", "merchant_contains"],
    ["TARGET", "shopping", "merchant_contains"],
    ["WAYFAIR", "shopping", "merchant_contains"],
    ["CHEWY", "shopping", "merchant_contains"],
    ["EBAY", "shopping", "merchant_contains"],
    ["COMCAST", "utilities", "merchant_contains"],
    ["XFINITY", "utilities", "merchant_contains"],
    ["CENTERPOINT", "utilities", "merchant_contains"],
    ["RELIANT", "utilities", "merchant_contains"],
    ["TXUCOL", "utilities", "merchant_contains"],
    ["ONCOR", "utilities", "merchant_contains"],
    ["ATMOS", "utilities", "merchant_contains"],
    ["VERIZON", "phone", "merchant_contains"],
    ["AT&T", "phone", "merchant_contains"],
    ["T-MOBILE", "phone", "merchant_contains"],
    ["TMOBILE", "phone", "merchant_contains"],
    ["SHELL", "auto", "merchant_contains"],
    ["CHEVRON", "auto", "merchant_contains"],
    ["EXXON", "auto", "merchant_contains"],
    ["VALERO", "auto", "merchant_contains"],
    ["MURPHY USA", "auto", "merchant_contains"],
    ["BUCEES", "auto", "merchant_contains"],
    ["BUC-EE", "auto", "merchant_contains"],
    ["PARKWAY", "auto", "merchant_contains"],
    ["HONDA", "auto", "merchant_contains"],
    ["GEICO", "auto", "merchant_contains"],
    ["PROGRESSIVE", "auto", "merchant_contains"],
    ["CAR WASH", "auto", "merchant_contains"],
    ["HOUSTON METHODIST", "healthcare", "merchant_contains"],
    ["HCA HOSPITAL", "healthcare", "merchant_contains"],
    ["MEMORIAL HERMANN", "healthcare", "merchant_contains"],
    ["LABCORP", "healthcare", "merchant_contains"],
    ["QUEST DIAG", "healthcare", "merchant_contains"],
    ["URGENT CARE", "healthcare", "merchant_contains"],
    ["DENTAL", "healthcare", "merchant_contains"],
    ["VISION", "healthcare", "merchant_contains"],
    ["OPTUM", "healthcare", "merchant_contains"],
    ["PROGYNY", "fertility", "merchant_contains"],
    ["FERTILITY", "fertility", "merchant_contains"],
    ["IVF", "fertility", "merchant_contains"],
    ["CVS", "pharmacy", "merchant_contains"],
    ["WALGREENS", "pharmacy", "merchant_contains"],
    ["WALGREEN", "pharmacy", "merchant_contains"],
    ["PHARMACY", "pharmacy", "merchant_contains"],
    ["RX", "pharmacy", "merchant_contains"],
    ["BETTERMENT", "investing", "merchant_contains"],
    ["FIDELITY", "investing", "merchant_contains"],
    ["VANGUARD", "investing", "merchant_contains"],
    ["SCHWAB", "investing", "merchant_contains"],
    ["ROBINHOOD", "investing", "merchant_contains"],
    ["DISCOVER E PAYMENT", "credit_payment", "merchant_contains"],
    ["CITI PAYMENT", "credit_payment", "merchant_contains"],
    ["CHASE PAYMENT", "credit_payment", "merchant_contains"],
    ["AUTOPAY", "credit_payment", "merchant_contains"],
    ["ONLINE PAYMENT", "credit_payment", "merchant_contains"],
    ["ATM", "cash_atm", "merchant_contains"],
    ["WITHDRAWAL", "cash_atm", "merchant_contains"],
    ["CASH", "cash_atm", "merchant_contains"]
  ]'::jsonb;
  v_inserted_cats int := 0;
  v_inserted_rules int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated.';
  end if;

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

  declare
    v_rule jsonb;
    v_pattern text;
    v_cat_key text;
    v_rule_type text;
    v_category_id uuid;
  begin
    for v_rule in select * from jsonb_array_elements(v_rules)
    loop
      v_pattern := v_rule->>0;
      v_cat_key := v_rule->>1;
      v_rule_type := coalesce(v_rule->>2, 'merchant_contains');
      v_category_id := (v_cat_ids->>v_cat_key)::uuid;

      if v_category_id is null then
        continue;
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
