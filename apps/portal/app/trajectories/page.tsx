import type { Metadata } from "next";
import TrajectoryViewer from "./viewer";

export const metadata: Metadata = { title: "Trajectory viewer", description: "Read agent messages, thinking, and tool calls in one clear timeline." };

export default function TrajectoriesPage() {
  return <TrajectoryViewer />;
}
