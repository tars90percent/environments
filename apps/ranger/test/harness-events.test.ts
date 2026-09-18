import test from "node:test";
import assert from "node:assert/strict";
import { HarnessEvents } from "../src/harness-events.js";
import { chunkText } from "../src/state.js";

test("ACP projection groups assistant blocks and orders distinct tool calls without results or thoughts",()=>{
  const seen: unknown[]=[];
  const events=new HarnessEvents({onText:(text,id)=>seen.push({text,id}),onToolCall:call=>seen.push(call)});
  events.accept({sessionUpdate:"agent_message_chunk",messageId:"m1",content:{type:"text",text:"Checking "}});
  events.accept({sessionUpdate:"agent_thought_chunk",messageId:"m1",content:{type:"text",text:"PRIVATE_REASONING"}});
  events.accept({sessionUpdate:"agent_message_chunk",messageId:"m1",content:{type:"text",text:"the file."}});
  const tool={sessionUpdate:"tool_call" as const,toolCallId:"t1",title:"read",rawInput:{file_path:"/tmp/example"},rawOutput:"PRIVATE_OUTPUT",content:[{type:"content" as const,content:{type:"text" as const,text:"PRIVATE_OUTPUT"}}]};
  events.accept(tool);events.accept(tool);
  events.accept({sessionUpdate:"tool_call_update",toolCallId:"t1",status:"completed",rawOutput:"PRIVATE_OUTPUT"});
  events.accept({...tool,toolCallId:"t2",name:"read_again"});
  events.accept({sessionUpdate:"agent_message_chunk",messageId:"m2",content:{type:"text",text:"First answer."}});
  events.accept({sessionUpdate:"agent_message_chunk",messageId:"m3",content:{type:"text",text:"Second answer."}});
  assert.equal(events.finish(),"Checking the file.\n\nFirst answer.\n\nSecond answer.");
  assert.deepEqual(seen,[{text:"Checking the file.",id:"m1"},{id:"t1",name:"read",input:{file_path:"/tmp/example"}},{id:"t2",name:"read_again",input:{file_path:"/tmp/example"}},{text:"First answer.",id:"m2"},{text:"Second answer.",id:"m3"}]);
});

test("usage events flush committed text promptly; missing message IDs flush at completion",()=>{
  const texts:string[]=[];const events=new HarnessEvents({onText:text=>texts.push(text)});
  events.accept({sessionUpdate:"agent_message_chunk",messageId:"m1",content:{type:"text",text:"Committed."}});
  events.accept({sessionUpdate:"usage_update",used:10,size:100});
  assert.deepEqual(texts,["Committed."]);
  events.accept({sessionUpdate:"agent_message_chunk",content:{type:"text",text:"Fallback "}});
  events.accept({sessionUpdate:"agent_message_chunk",content:{type:"text",text:"blocks."}});
  events.finish();events.finish();assert.deepEqual(texts,["Committed.","Fallback blocks."]);
});

test("long replies prefer paragraph, line and word boundaries while preserving Unicode and all text",()=>{
  for(const boundary of ["\n\n","\n"," "]) {
    const prefix="🛰".repeat(18)+boundary,text=prefix+"测".repeat(30);
    const chunks=chunkText(text,30);assert.equal(chunks[0],prefix);
    assert.equal(chunks.join(""),text);assert(chunks.every(x=>Array.from(x).length<=30));
  }
  const text="🛰测".repeat(40),chunks=chunkText(text,30);
  assert.equal(chunks.join(""),text);assert(chunks.every(x=>Array.from(x).length<=30));
});
