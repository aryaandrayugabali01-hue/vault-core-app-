import { Router } from 'express';
import { getPublicCatalogVariants, toLegacyCatalogResponse } from '../services/publicCatalogService.js';

const router = Router();

// Backward-compatible response adapter. Product eligibility, price, stock,
// rights review and encrypted-account checks all come from the canonical v4 source.
router.get('/', async (_req,res) => {
  const variants=await getPublicCatalogVariants();
  return res.json(toLegacyCatalogResponse(variants));
});

export default router;
