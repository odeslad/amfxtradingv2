import { Router } from 'express';
import { getAllPositions } from '../store/positions';

const router = Router();

router.get('/live', (_req, res) => {
  res.json(getAllPositions());
});

export default router;
