import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const router = Router();

router.post('/', (req, res) => {
  const command = req.body as Record<string, unknown>;

  if (!command['action'] || !command['id'] || !command['broker']) {
    res.status(400).json({ error: 'action, id and broker are required' });
    return;
  }

  const broker = config.brokers.find((b) => b.name === command['broker']);
  if (!broker) {
    res.status(404).json({ error: `Unknown broker: ${command['broker']}` });
    return;
  }

  const commandPath = path.join(broker.bridgePath, 'command.json');

  if (fs.existsSync(commandPath)) {
    res.status(409).json({ error: 'A command is already pending for this broker' });
    return;
  }

  try {
    fs.writeFileSync(commandPath, JSON.stringify(command));
    res.status(202).json({ status: 'accepted', id: command['id'] });
  } catch (err) {
    console.error(`[CMD:${command['broker']}] Failed to write command.json`, err);
    res.status(500).json({ error: 'Failed to write command' });
  }
});

export default router;
