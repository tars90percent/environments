import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const result = await build({ entryPoints: [new URL('../app/trajectories/trajectory.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', write: false });
const { parseTrajectory, demoTrajectory } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const parse = (messages, other = {}) => parseTrajectory(JSON.stringify({ messages, ...other }));

test('pairs out-of-order parallel results by ID and indexes their exact source messages', () => {
  const trajectory = parse([
    { role: 'assistant', content: [{ type: 'tool_use', id: 'a', name: 'Read', input: {} }, { type: 'tool_use', id: 'b', name: 'Bash', input: {} }] },
    { role: 'system', content: 'Context preserved' },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'b', content: 'second returned first', is_error: true }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: 'first returned last' }] },
  ]);
  assert.equal(trajectory.results.get('a')[0].messageIndex, 3);
  assert.equal(trajectory.results.get('b')[0].messageIndex, 2);
  assert.equal(trajectory.steps.length, 2);
  assert.equal(trajectory.errorCount, 1);
  assert.ok(trajectory.steps[0].search.includes('second returned first'));
  assert.equal(trajectory.steps[1].role, 'system');
});

test('preserves mixed text/results, unmatched results, empty messages, and unfamiliar blocks', () => {
  const messages = [
    { role: 'assistant', content: [{ type: 'tool_use', id: 'a', name: 'Read' }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: 'returned' }, { type: 'text', text: 'Also inspect the tests' }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'missing', content: 'orphan' }] },
    { role: 'assistant', content: null },
    { role: 'user', content: [{ type: 'image', source: { url: 'https://example.com/image' } }, 7] },
  ];
  const t = parse(messages);
  assert.equal(t.steps.length, 5);
  assert.deepEqual(t.raw.messages, messages);
  assert.equal(t.steps[1].blocks[0].text, 'Also inspect the tests');
  assert.equal(t.steps[2].blocks[0].tool_use_id, 'missing');
  assert.equal(t.steps[3].blocks.length, 0);
  assert.equal(t.steps[4].blocks[1].value, 7);
});

test('accepts OpenAI tool calls, preserves invalid argument JSON and reasoning', () => {
  const t = parse([
    { role: 'assistant', content: null, reasoning_content: 'Inspect first', tool_calls: [{ id: 'a', function: { name: 'Read', arguments: '{"path":"demo"}' } }, { id: 'b', function: { name: 'Read', arguments: 'unfinished{' } }] },
    { role: 'tool', tool_call_id: 'a', content: 'file contents' },
  ]);
  assert.equal(t.steps[0].blocks[0].thinking, 'Inspect first');
  assert.deepEqual(t.steps[0].blocks[1].input, { path: 'demo' });
  assert.equal(t.steps[0].blocks[2].input, 'unfinished{');
  assert.equal(t.results.get('a')[0].block.content, 'file contents');
  assert.equal(t.results.has('b'), false);
});

test('retains multiple result blocks and root settings verbatim', () => {
  const t = parse([
    { role: 'assistant', content: [{ type: 'tool_use', id: 'a', name: 'Read' }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: 'one' }, { type: 'tool_result', tool_use_id: 'a', content: 'two' }] },
  ], { system: [{ type: 'text', text: 'context' }], tools: [{ name: 'Read' }], max_tokens: 100 });
  assert.equal(t.results.get('a').length, 2);
  assert.deepEqual(t.settings, { system: [{ type: 'text', text: 'context' }], tools: [{ name: 'Read' }], max_tokens: 100 });
});

test('rejects malformed inputs with helpful errors and accepts empty trajectories', () => {
  assert.throws(() => parseTrajectory('{'), /valid JSON/);
  assert.throws(() => parseTrajectory('[]'), /messages/);
  assert.throws(() => parse([null]), /Message 1/);
  assert.throws(() => parse([{ content: 'text' }]), /role/);
  assert.equal(parse([]).messageCount, 0);
  assert.equal(parseTrajectory('\uFEFF' + demoTrajectory).toolCount, 3);
});
