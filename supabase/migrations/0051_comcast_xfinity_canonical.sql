-- Align SQL canonical merchant normalization with edge-function merchant aliasing.
-- This collapses Comcast/Xfinity variants to COMCAST for better recurring/rule dedupe.

create or replace function public.normalize_merchant_canonical(input text)
returns text
language plpgsql
immutable
as $$
declare
  working text := upper(coalesce(input, ''));
begin
  working := regexp_replace(working, '[0-9]', ' ', 'g');
  working := regexp_replace(working, '[^A-Z\s]', ' ', 'g');

  working := regexp_replace(working, '\m(POS|DEBIT|CREDIT|PURCHASE|ONLINE|WEB|WWW|SQ|PAYPAL|VENMO|CASHAPP|AUTH|HOLD)\M', ' ', 'g');
  working := regexp_replace(
    working,
    '\m(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\M',
    ' ',
    'g'
  );

  working := regexp_replace(working, '\s+', ' ', 'g');
  working := trim(working);

  if working like '%APPLE COM BILL%' or working like '%ITUNES%' then
    return 'APPLE';
  end if;
  if working like '%NETFLIX%' then
    return 'NETFLIX';
  end if;
  if working like '%SPOTIFY%' then
    return 'SPOTIFY';
  end if;
  if working ~ '(^| )(COMCAST|XFINITY)( |$)' then
    return 'COMCAST';
  end if;
  if working like '%AMZN%' or working like '%AMAZON MARKETPLACE%' or working like '%AMAZON%' then
    return 'AMAZON';
  end if;
  if working ~ '(^| )GOOGLE( .*| )SERVICES?( |$)' then
    return 'GOOGLE';
  end if;

  if working = '' then
    return 'UNKNOWN';
  end if;

  return left(array_to_string((string_to_array(working, ' '))[1:3], ' '), 32);
end;
$$;

update public.transactions
set merchant_canonical = public.normalize_merchant_canonical(
  coalesce(
    nullif(merchant_canonical, ''),
    nullif(merchant_normalized, ''),
    description_short,
    ''
  )
)
where coalesce(merchant_canonical, '') ~* '(comcast|xfinity)'
   or coalesce(merchant_normalized, '') ~* '(comcast|xfinity)'
   or coalesce(description_short, '') ~* '(comcast|xfinity)';
