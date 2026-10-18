import { defineTool } from 'eve/tools';
import { z } from 'zod';
export default defineTool({
 description: 'Read verified shared shop facts and agent decisions. Always use before answering policy questions.',
 inputSchema: z.object({}),
 async execute() {
  const response = await fetch('http://127.0.0.1:4317/api/state');
  if (!response.ok) throw new Error('Start Memory Airlock before using this tool.');
  const data = await response.json();
  return { backend: data.backend, revision: data.state.revision, facts: data.state.facts.filter((f: { status: string }) => f.status === 'active'), decisions: data.state.decisions.filter((d: { status: string }) => d.status === 'current') };
 },
});
