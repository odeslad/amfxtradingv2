import express from 'express';
import commandsRouter from './routes/commands';
import strategiesRouter from './routes/strategies';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/commands', commandsRouter);
app.use('/strategies', strategiesRouter);

export default app;
