-- Pause legacy active commercial products that do not match the account-only catalogue contract.
UPDATE products p
SET status='PAUSED', updated_at=NOW()
WHERE COALESCE(p.is_test,FALSE)=FALSE
  AND p.status='ACTIVE'
  AND (
    p.fulfillment_type IS DISTINCT FROM 'GAME_ACCOUNT_TRANSFER'
    OR p.game_category IS NULL
    OR p.game_category NOT IN ('MLBB','FREE_FIRE','ROBLOX','GENSHIN')
    OR p.marketplace_category_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM marketplace_categories mc
      WHERE mc.id=p.marketplace_category_id
        AND mc.is_active=TRUE
        AND mc.slug=CASE p.game_category
          WHEN 'MLBB' THEN 'mlbb-akun'
          WHEN 'FREE_FIRE' THEN 'free-fire-akun'
          WHEN 'ROBLOX' THEN 'roblox-akun'
          WHEN 'GENSHIN' THEN 'genshin-akun'
        END
    )
  );
