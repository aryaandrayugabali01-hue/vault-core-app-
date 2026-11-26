import { Router } from 'express';
import { getPublicCatalogVariants } from '../services/publicCatalogService.js';

const router = Router();

router.get('/variants', async (_req,res) => {
  const variants=await getPublicCatalogVariants();
  return res.json({
    variants,
    counts:{
      variants:variants.length,
      sku:variants.reduce((count,variant)=>count+variant.skus.length,0)
    }
  });
});

export default router;
