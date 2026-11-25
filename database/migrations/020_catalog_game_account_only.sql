-- Keep only one public account category for each supported game.
UPDATE marketplace_categories
SET slug='mlbb-akun',name='Akun',description='Akun Mobile Legends: Bang Bang',is_active=TRUE,updated_at=NOW()
WHERE id=1;

UPDATE marketplace_categories
SET slug='free-fire-akun',name='Akun',description='Akun Free Fire',is_active=TRUE,updated_at=NOW()
WHERE id=9;

UPDATE marketplace_categories
SET slug='genshin-akun',name='Akun',description='Akun Genshin Impact',is_active=TRUE,updated_at=NOW()
WHERE id=13;

INSERT INTO marketplace_categories (slug,name,description,icon,purchase_guide,sort_order,is_active)
SELECT 'roblox-akun','Akun','Akun Roblox','◇','[]'::jsonb,30,TRUE
WHERE NOT EXISTS (SELECT 1 FROM marketplace_categories WHERE slug='roblox-akun');

UPDATE marketplace_categories
SET is_active=FALSE,updated_at=NOW()
WHERE slug NOT IN ('mlbb-akun','free-fire-akun','roblox-akun','genshin-akun');

UPDATE products
SET marketplace_category_id=(SELECT id FROM marketplace_categories WHERE slug='free-fire-akun'),
    updated_at=NOW()
WHERE sku IN ('FF-001','FF-002') AND game_category='FREE_FIRE' AND fulfillment_type='GAME_ACCOUNT_TRANSFER';

UPDATE products
SET marketplace_category_id=(SELECT id FROM marketplace_categories WHERE slug='genshin-akun'),
    updated_at=NOW()
WHERE sku IN ('GI-001','GI-002','GI-003') AND game_category='GENSHIN' AND fulfillment_type='GAME_ACCOUNT_TRANSFER';

-- Pause legacy products that are not transferable game accounts.
UPDATE products
SET status='PAUSED',updated_at=NOW()
WHERE COALESCE(is_test,FALSE)=FALSE
  AND (fulfillment_type <> 'GAME_ACCOUNT_TRANSFER'
       OR game_category NOT IN ('MLBB','FREE_FIRE','ROBLOX','GENSHIN')
       OR marketplace_category_id IS NULL);
