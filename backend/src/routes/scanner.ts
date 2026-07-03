import { Router } from 'express';
import { runScanner } from '../services/scanner';

const router = Router();

router.get('/', async (req, res) => {
  const { broker, tf, emaFast, emaSlow } = req.query as Record<string, string>;

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
});

export default router;
