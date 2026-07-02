import { Router } from 'express';
import { runScanner } from '../services/scanner';

const router = Router();

router.get('/', async (req, res) => {
  const { broker, tf, emaFast, emaSlow, recentWithin } = req.query as Record<string, string>;

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
  const recent = recentWithin ? parseInt(recentWithin, 10) : 3;
  const recentSafe = Number.isInteger(recent) && recent >= 0 ? recent : 3;

  const result = await runScanner(broker, tf, fast, slow, recentSafe);
  res.json(result);
});

export default router;
