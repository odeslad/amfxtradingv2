import { Router } from 'express';
import { runScanner } from '../services/scanner';
import { asyncRoute } from '../middleware/asyncRoute';
import { singleQuery } from '../middleware/parse';

const router = Router();

router.get('/', asyncRoute(async (req, res) => {
  const broker = singleQuery(req.query, 'broker');
  const tf = singleQuery(req.query, 'tf');
  const emaFast = singleQuery(req.query, 'emaFast');
  const emaSlow = singleQuery(req.query, 'emaSlow');

  if (!broker || !tf || !emaFast || !emaSlow) {
    res.status(400).json({ message: 'broker, tf, emaFast and emaSlow are required' });
    return;
  }
  const fast = parseInt(emaFast, 10);
  const slow = parseInt(emaSlow, 10);
  if (!Number.isInteger(fast) || !Number.isInteger(slow) || fast <= 0 || slow <= 0 || fast === slow) {
    res.status(400).json({ message: 'emaFast and emaSlow must be positive integers and differ' });
    return;
  }

  const result = await runScanner(broker, tf, fast, slow);
  res.json(result);
}));

export default router;
