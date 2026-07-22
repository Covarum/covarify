create unique index if not exists plaid_items_one_production_per_user_idx
on public.plaid_items (user_id)
where environment = 'production';
