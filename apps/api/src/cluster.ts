import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

/**
 * Arranque em cluster: vários processos da API a partilhar a mesma porta, um por núcleo.
 * Um processo Node.js usa um só núcleo; medido neste projeto, o limite de um processo é de
 * ~500-750 pedidos/s com base de dados. Usar quando a API corre numa VM/servidor com vários núcleos.
 * Em plataformas de contentores (Cloud Run, Railway, Fly...), prefira várias réplicas de `node dist/main.js`.
 *
 *   WEB_CONCURRENCY=4 node dist/cluster.js
 */
const workers = Number(process.env.WEB_CONCURRENCY) || availableParallelism();

if (cluster.isPrimary) {
  // No Windows a distribuição por omissão é muito desequilibrada (documentação do Node.js).
  cluster.schedulingPolicy = cluster.SCHED_RR;
  let shuttingDown = false;
  for (let i = 0; i < workers; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    if (shuttingDown) return;
    console.error(`Processo ${worker.process.pid} terminou (${signal ?? code}); a arrancar outro.`);
    cluster.fork();
  });

  const shutdown = () => {
    shuttingDown = true;
    for (const worker of Object.values(cluster.workers ?? {})) worker?.kill('SIGTERM');
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  console.log(`API em cluster: ${workers} processos`);
} else {
  await import('./main.js');
}
