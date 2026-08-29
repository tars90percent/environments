export type UpstreamTaskFilesystemEntry = {
  path: string;
  kind: "directory" | "file";
  sizeBytes: number | null;
  role: "documentation" | "task-instruction" | "task-config" | "environment" | "input-artifact" | "environment-helper" | "reference-solution" | "verifier" | "repository";
};

export type UpstreamTaskFilesystem = {
  repository: string;
  repositoryPath: string;
  rootUrl: string;
  treeSha: string;
  verifiedAt: string;
  entries: UpstreamTaskFilesystemEntry[];
};

const sharedRootEntries: UpstreamTaskFilesystemEntry[] = [
  { path: ".gitignore", kind: "file", sizeBytes: 177, role: "repository" },
];

export const modelBenchmarkTaskFilesystems: Record<string, UpstreamTaskFilesystem> = {
  "terminal-wal-recovery": {
    repository: "harbor-framework/terminal-bench-2-1",
    repositoryPath: "tasks/db-wal-recovery",
    rootUrl: "https://github.com/harbor-framework/terminal-bench-2-1/tree/main/tasks/db-wal-recovery",
    treeSha: "7131e4375048a0e408a8fb404b5f499d726b695b",
    verifiedAt: "2026-08-29",
    entries: [
      ...sharedRootEntries,
      { path: "README.md", kind: "file", sizeBytes: 2040, role: "documentation" },
      { path: "environment", kind: "directory", sizeBytes: null, role: "environment" },
      { path: "environment/Dockerfile", kind: "file", sizeBytes: 407, role: "environment" },
      { path: "environment/main.db", kind: "file", sizeBytes: 8192, role: "input-artifact" },
      { path: "environment/main.db-wal.encrypted", kind: "file", sizeBytes: 16512, role: "input-artifact" },
      { path: "instruction.md", kind: "file", sizeBytes: 658, role: "task-instruction" },
      { path: "solution", kind: "directory", sizeBytes: null, role: "reference-solution" },
      { path: "solution/solve.sh", kind: "file", sizeBytes: 3080, role: "reference-solution" },
      { path: "task.toml", kind: "file", sizeBytes: 926, role: "task-config" },
      { path: "tests", kind: "directory", sizeBytes: null, role: "verifier" },
      { path: "tests/test.sh", kind: "file", sizeBytes: 608, role: "verifier" },
      { path: "tests/test_outputs.py", kind: "file", sizeBytes: 4263, role: "verifier" },
    ],
  },
  "terminal-financial-documents": {
    repository: "harbor-framework/terminal-bench-2-1",
    repositoryPath: "tasks/financial-document-processor",
    rootUrl: "https://github.com/harbor-framework/terminal-bench-2-1/tree/main/tasks/financial-document-processor",
    treeSha: "7131e4375048a0e408a8fb404b5f499d726b695b",
    verifiedAt: "2026-08-29",
    entries: [
      ...sharedRootEntries,
      { path: "README.md", kind: "file", sizeBytes: 1992, role: "documentation" },
      { path: "environment", kind: "directory", sizeBytes: null, role: "environment" },
      { path: "environment/Dockerfile", kind: "file", sizeBytes: 623, role: "environment" },
      { path: "environment/documents", kind: "directory", sizeBytes: null, role: "input-artifact" },
      { path: "environment/documents/1t2tala7.jpg", kind: "file", sizeBytes: 885857, role: "input-artifact" },
      { path: "environment/documents/41ibljh7.pdf", kind: "file", sizeBytes: 2052, role: "input-artifact" },
      { path: "environment/documents/53lc58dr.jpg", kind: "file", sizeBytes: 626863, role: "input-artifact" },
      { path: "environment/documents/5lxo6qji.pdf", kind: "file", sizeBytes: 1629, role: "input-artifact" },
      { path: "environment/documents/8mdd4v30.jpg", kind: "file", sizeBytes: 254400, role: "input-artifact" },
      { path: "environment/documents/9t84azyt.pdf", kind: "file", sizeBytes: 2046, role: "input-artifact" },
      { path: "environment/documents/c11ertj5.pdf", kind: "file", sizeBytes: 2019, role: "input-artifact" },
      { path: "environment/documents/dbdw2pcn.pdf", kind: "file", sizeBytes: 8412, role: "input-artifact" },
      { path: "environment/documents/g0fn9xuy.jpg", kind: "file", sizeBytes: 192117, role: "input-artifact" },
      { path: "environment/documents/hv3a3zmf.jpg", kind: "file", sizeBytes: 212125, role: "input-artifact" },
      { path: "environment/documents/jxepq85j.jpg", kind: "file", sizeBytes: 202461, role: "input-artifact" },
      { path: "environment/documents/pbhsahxt.jpg", kind: "file", sizeBytes: 221526, role: "input-artifact" },
      { path: "environment/documents/sg65kxvf.jpg", kind: "file", sizeBytes: 770021, role: "input-artifact" },
      { path: "environment/documents/ujv6oh9s.jpg", kind: "file", sizeBytes: 287187, role: "input-artifact" },
      { path: "environment/documents/wnnhj7xv.pdf", kind: "file", sizeBytes: 2780, role: "input-artifact" },
      { path: "environment/documents/xaji0y6d.jpg", kind: "file", sizeBytes: 110509, role: "input-artifact" },
      { path: "environment/documents/zbikcidk.jpg", kind: "file", sizeBytes: 220646, role: "input-artifact" },
      { path: "environment/randomize_filenames.py", kind: "file", sizeBytes: 1392, role: "environment-helper" },
      { path: "instruction.md", kind: "file", sizeBytes: 1055, role: "task-instruction" },
      { path: "solution", kind: "directory", sizeBytes: null, role: "reference-solution" },
      { path: "solution/solve.sh", kind: "file", sizeBytes: 11621, role: "reference-solution" },
      { path: "task.toml", kind: "file", sizeBytes: 985, role: "task-config" },
      { path: "tests", kind: "directory", sizeBytes: null, role: "verifier" },
      { path: "tests/test.sh", kind: "file", sizeBytes: 629, role: "verifier" },
      { path: "tests/test_outputs.py", kind: "file", sizeBytes: 10336, role: "verifier" },
    ],
  },
};

export function upstreamFilesystemEntryUrl(filesystem: UpstreamTaskFilesystem, entry: UpstreamTaskFilesystemEntry): string {
  const view = entry.kind === "directory" ? "tree" : "blob";
  return `https://github.com/${filesystem.repository}/${view}/main/${filesystem.repositoryPath}/${entry.path}`;
}
