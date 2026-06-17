import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const router = Router();

router.post('/', (req, res) => {
  const command = req.body as Record<string, unknown>;

  if (!command['action'] || !command['id']) {
    res.status(400).json({ error: 'action and id are required' });
    return;
  }

  const commandPath = path.join(config.bridgePath, 'command.json');

  if (fs.existsSync(commandPath)) {
    res.status(409).json({ error: 'A command is already pending' });
    return;
  }

  try {
    fs.writeFileSync(commandPath, JSON.stringify(command));
    res.status(202).json({ status: 'accepted', id: command['id'] });
  } catch (err) {
    console.error('[CMD] Failed to write command.json', err);
    res.status(500).json({ error: 'Failed to write command' });
  }
});

export default router;
