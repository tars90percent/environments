import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const bundle = await build({
  entryPoints: [new URL("../app/portal-client.tsx", import.meta.url).pathname],
  bundle: true, format: "cjs", platform: "node", packages: "external", jsx: "automatic", write: false,
});
const compiledModule = { exports: {} };
// These components do not use Next Image; keep the unrelated shell import inert.
new Function("module", "exports", "require", bundle.outputFiles[0].text)(compiledModule, compiledModule.exports, (id) => id === "next/image" ? () => null : require(id));
const { BenchmarkCard, BenchmarkDetail } = compiledModule.exports;
const records = ["mercor", "unipat", "other"].map((id) => ({
  vendor: { id, name: id, interactions: [], submissions: [] },
  submission: { id: `${id}-submission`, label: `${id} delivery`, date: "2026-09-07" },
  task: { id, title: `${id} task`, kind: "task", format: "harbor", benchmark: { id: "deep-swe", displayName: "DeepSWE" }, checks: {}, findings: [], sourceItemIds: [] },
}));
for (const record of records) record.vendor.submissions.push({ ...record.submission, tasks: [record.task] });
const benchmark = { id: "deep-swe", displayName: "DeepSWE", categoryId: "active-procurement", records, taskCount: 3, vendorCount: 3, shortlist: { vendorIds: ["mercor", "unipat"], records: records.slice(0, 2), vendorCount: 2 } };
const renderDetail = (language, matching = records) => renderToStaticMarkup(createElement(BenchmarkDetail, { benchmark, records: matching, vendors: records.map((record) => record.vendor), language, downloadHref: "/all-vendors", onOpenVendor() {} }));

test("shortlist card and detail distinguish candidates from retained catalog samples in both languages", () => {
  for (const [language, shortlistLabel, otherLabel] of [["en", "shortlisted vendors", "Other cataloged samples"], ["zh", "入围供应商", "其他已收录样本"]]) {
    const card = renderToStaticMarkup(createElement(BenchmarkCard, { group: benchmark, language, totalTasks: 3, onSelect() {} }));
    assert.ok(card.includes(`2 ${shortlistLabel}`));
    assert.ok(card.includes("mercor · unipat"));
    assert.ok(!card.includes("benchmark-share"), "active procurement does not display catalog-share bars");
    const html = renderDetail(language);
    const collapsed = html.slice(html.indexOf('<details class="benchmark-other-samples">'), html.indexOf('<div class="benchmark-catalog-download">'));
    assert.ok(collapsed.startsWith('<details class="benchmark-other-samples">'), "other vendors are in a closed native disclosure");
    assert.ok(collapsed.includes(otherLabel));
    assert.ok(collapsed.includes("other task"));
    assert.ok(collapsed.includes("other delivery"));
    assert.ok(!collapsed.includes("mercor task"));
    assert.ok(html.indexOf("unipat task") < html.indexOf(otherLabel));
    assert.equal((html.match(/class="vendor-inventory"/g) ?? []).length, 3);
    assert.ok(html.includes(language === "en" ? "Download all shortlisted samples" : "下载全部入围样本"));
    assert.ok(html.includes("2 Harbor"), "shortlist download displays its unfiltered count");
    assert.ok(html.includes("3 Harbor"), "all-vendor download retains its full count");
  }
});

test("search can find other vendors without promoting them into the shortlist", () => {
  const html = renderDetail("en", [records[2]]);
  assert.ok(html.includes("No matching records."));
  assert.ok(html.indexOf("other task") > html.indexOf("Other cataloged samples"));
  assert.ok(!html.includes("mercor task"));
});
