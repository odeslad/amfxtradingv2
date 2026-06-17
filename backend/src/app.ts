import express from 'express';
import commandsRouter from './routes/commands';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/commands', commandsRouter);

export default app;
