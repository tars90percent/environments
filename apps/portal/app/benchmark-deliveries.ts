import type { CatalogVendor } from "./catalog";

export function benchmarkDeliveries(vendors: CatalogVendor[], benchmarkId: string) {
  return vendors.flatMap((vendor) => vendor.submissions.flatMap((submission) => {
    const tasks = submission.tasks.filter((task) => task.kind === "task" && task.benchmark.id === benchmarkId);
    if (!tasks.length) return [];
    return [{
      vendorId: vendor.id,
      vendorName: vendor.name,
      submissionId: submission.id,
      label: submission.label,
      date: submission.date,
      taskCount: tasks.length,
      harborCount: tasks.filter((task) => task.format === "harbor").length,
    }];
  })).sort((a, b) => a.date.localeCompare(b.date) || a.vendorName.localeCompare(b.vendorName) || a.submissionId.localeCompare(b.submissionId));
}
