import test from "node:test";
import assert from "node:assert/strict";
import { formatToolNotice } from "../src/tool-notice.js";

test("tool notices preserve useful arguments while masking known credentials and sensitive fields",()=>{
  const text=formatToolNotice({id:"t1",name:"bash",input:{command:"cat /tmp/example.txt",nested:{password:"HIDDEN_PASSWORD",access_token:"HIDDEN_TOKEN"},values:["known-secret-value"],Authorization:"HIDDEN_AUTH"}},{DEEPSEEK_API_KEY:"known-secret-value"});
  assert.match(text,/🔧 Tool call: bash/);assert.match(text,/cat \/tmp\/example.txt/);
  assert.doesNotMatch(text,/HIDDEN_|known-secret-value/);assert.match(text,/\[redacted\]/);
  const command=formatToolNotice({id:"t",name:"bash",input:"API_KEY=known-secret-value command"},{API_KEY:"known-secret-value"});
  assert.match(command,/API_KEY=\[redacted\] command/);
});

test("tool notices redact credentials embedded in commands and headers before truncation",()=>{
  const command=["API_KEY=HIDDEN_API command --password 'HIDDEN_PASS'",'curl -H "Authorization: Bearer HIDDEN_BEARER" -H "Cookie: sid=HIDDEN_COOKIE" https://user:HIDDEN_URL@example.com',"const token = 'HIDDEN_TOKEN';",'-----BEGIN PRIVATE KEY-----\nHIDDEN_PEM\n-----END PRIVATE KEY-----',"Basic HIDDEN_BASIC","x".repeat(2170)+"known-secret-value"].join("\n");
  const text=formatToolNotice({id:"t1",name:"bash",input:{command}},{APP_SECRET:"known-secret-value"});
  assert.doesNotMatch(text,/HIDDEN_|known-secret/);assert.match(text,/arguments truncated/);
  assert(Array.from(text).length<3000);
});

test("tool notices handle absent and Unicode arguments within a single Feishu message",()=>{
  assert.equal(formatToolNotice({id:"t",name:"inspect",input:undefined},{}),"🔧 Tool call: inspect");
  const text=formatToolNotice({id:"t",name:"read",input:{path:"🛰".repeat(4000)}},{});
  assert(Array.from(text).length<3000);assert.match(text,/arguments truncated/);
});
