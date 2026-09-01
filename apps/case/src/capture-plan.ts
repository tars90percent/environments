import type { RegistryVendorInput, SampleTaskFormat } from "./registry/types.js";

export type FeishuAttachmentPlan = {
  messageId: string;
  fileKey: string;
  filename: string;
  messageLink: string;
  sender?: string;
  receivedAt: string;
};

export type MailAttachmentPlan = {
  messageId: string;
  attachmentId: string;
  filename: string;
  contentType?: string;
  sender?: string;
  receivedAt: string;
};

export type CaptureSubmissionPlan<TAttachment> = {
  vendor: RegistryVendorInput;
  submission: {
    id: string;
    date: string;
    label: string;
    format?: SampleTaskFormat;
    attachments: TAttachment[];
  };
};

export type CapturePlan<TAttachment> = {
  purpose: "sample_evaluation";
  submissions: Array<CaptureSubmissionPlan<TAttachment>>;
};

export function parseFeishuCapturePlan(value: unknown): CapturePlan<FeishuAttachmentPlan> {
  return parseCapturePlan(value, (attachment, path) => {
    const item = record(attachment, path);
    const messageId = requiredString(item.messageId, `${path}.messageId`);
    const fileKey = requiredString(item.fileKey, `${path}.fileKey`);
    if (!messageId.startsWith("om_")) throw new Error(`${path}.messageId is invalid`);
    if (!fileKey.startsWith("file_")) throw new Error(`${path}.fileKey is invalid`);
    return {
      messageId,
      fileKey,
      filename: requiredString(item.filename, `${path}.filename`),
      messageLink: requiredString(item.messageLink, `${path}.messageLink`),
      sender: optionalString(item.sender, `${path}.sender`),
      receivedAt: timestamp(item.receivedAt, `${path}.receivedAt`),
    };
  }, (attachment) => `${attachment.messageId}\u0000${attachment.fileKey}`);
}

export function parseMailCapturePlan(value: unknown): CapturePlan<MailAttachmentPlan> {
  return parseCapturePlan(value, (attachment, path) => {
    const item = record(attachment, path);
    return {
      messageId: requiredString(item.messageId, `${path}.messageId`),
      attachmentId: requiredString(item.attachmentId, `${path}.attachmentId`),
      filename: requiredString(item.filename, `${path}.filename`),
      contentType: optionalString(item.contentType, `${path}.contentType`),
      sender: optionalString(item.sender, `${path}.sender`),
      receivedAt: timestamp(item.receivedAt, `${path}.receivedAt`),
    };
  }, (attachment) => `${attachment.messageId}\u0000${attachment.attachmentId}`);
}

function parseCapturePlan<TAttachment>(
  value: unknown,
  parseAttachment: (value: unknown, path: string) => TAttachment,
  attachmentKey: (value: TAttachment) => string,
): CapturePlan<TAttachment> {
  const root = record(value, "capture plan");
  if (root.purpose !== "sample_evaluation") {
    throw new Error("Capture plan purpose must be sample_evaluation; purchased deliveries belong in the downstream pipeline");
  }
  if (!Array.isArray(root.submissions)) throw new Error("Capture plan submissions must be an array");
  const submissions = root.submissions.map((value, index) => {
    const item = record(value, `submissions[${index}]`);
    const vendor = record(item.vendor, `submissions[${index}].vendor`);
    const rawSubmission = item.submission;
    const submission = record(rawSubmission, `submissions[${index}].submission`);
    if (!Array.isArray(submission.attachments) || !submission.attachments.length) {
      throw new Error(`submissions[${index}].submission.attachments must not be empty`);
    }
    const format = submission.format === undefined ? undefined : taskFormat(submission.format, `submissions[${index}].submission.format`);
    const attachments = submission.attachments.map((attachment, attachmentIndex) =>
      parseAttachment(attachment, `submissions[${index}].submission.attachments[${attachmentIndex}]`));
    if (new Set(attachments.map(attachmentKey)).size !== attachments.length) {
      throw new Error(`submissions[${index}].submission.attachments contains a duplicate attachment`);
    }
    return {
      vendor: {
        id: identifier(vendor.id, `submissions[${index}].vendor.id`),
        name: requiredString(vendor.name, `submissions[${index}].vendor.name`),
        short: requiredString(vendor.short, `submissions[${index}].vendor.short`),
        description: requiredString(vendor.description, `submissions[${index}].vendor.description`),
        aliases: stringArray(vendor.aliases, `submissions[${index}].vendor.aliases`),
      },
      submission: {
        id: identifier(submission.id, `submissions[${index}].submission.id`),
        date: date(submission.date, `submissions[${index}].submission.date`),
        label: requiredString(submission.label, `submissions[${index}].submission.label`),
        ...(format ? { format } : {}),
        attachments,
      },
    };
  });
  if (new Set(submissions.map((item) => item.submission.id)).size !== submissions.length) {
    throw new Error("Capture plan submissions must use unique ids");
  }
  return { purpose: "sample_evaluation", submissions };
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${path} is required`);
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, path);
}

function identifier(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,499}$/.test(parsed)) throw new Error(`${path} is invalid`);
  return parsed;
}

function timestamp(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(`${path} is invalid`);
  return new Date(parsed).toISOString();
}

function date(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed) || Number.isNaN(Date.parse(`${parsed}T00:00:00Z`))) {
    throw new Error(`${path} is invalid`);
  }
  return parsed;
}

function taskFormat(value: unknown, path: string): SampleTaskFormat {
  if (value !== "harbor" && value !== "non_harbor") throw new Error(`${path} must be harbor or non_harbor`);
  return value;
}

function stringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${path} must be an array of strings`);
  }
  return value.map((item) => String(item).trim());
}
