export type TaskListLocation = {
  view: "benchmarks" | "vendors";
  benchmark: string | null;
  vendor: string;
  query: string;
  language: "zh" | "en";
};

export function taskListHref(location: TaskListLocation, localPreview = false): string {
  const params = new URLSearchParams({ view: location.view });
  if (location.view === "benchmarks" && location.benchmark) params.set("benchmark", location.benchmark);
  if (location.view === "vendors" && location.vendor) params.set("vendor", location.vendor);
  if (location.query) params.set("q", location.query);
  if (location.language === "en") params.set("lang", "en");
  return `${localPreview ? "/local-preview" : "/"}?${params}`;
}

// Only accept portal list destinations; never follow arbitrary return URLs.
export function readTaskListLocation(href: string | null, localPreview = false): TaskListLocation | null {
  if (!href) return null;
  const [path, search = ""] = href.split("?");
  if (path !== (localPreview ? "/local-preview" : "/")) return null;
  const params = new URLSearchParams(search);
  return {
    view: params.get("view") === "vendors" ? "vendors" : "benchmarks",
    benchmark: params.get("benchmark"),
    vendor: params.get("vendor") ?? "",
    query: params.get("q") ?? "",
    language: params.get("lang") === "en" ? "en" : "zh",
  };
}

export type PageSearchParams = Record<string, string | string[] | undefined>;

export function taskListPageLocation(params: PageSearchParams, localPreview = false): TaskListLocation | null {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") search.set(key, value);
  return readTaskListLocation(`${localPreview ? "/local-preview" : "/"}?${search}`, localPreview);
}
