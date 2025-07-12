import { createClient } from "@/lib/supabase/server";
import { fanOn, fanOff } from "@/app/api/agent/route";

export async function GET(req: Request) {
  console.log("[GET] /api/agent/cron called");
  const now = new Date();

  try {
    const supabase = await createClient();

    // Query for pending tasks scheduled at or before the current time
    const { data: tasks, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "pending")
      .lte("run_at", now.toISOString());

    if (fetchError) {
      console.error("Error fetching scheduled tasks:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch scheduled tasks" }), { status: 500 });
    }

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "No pending tasks to run." }), { status: 200 });
    }

    console.log(`Found ${tasks.length} tasks to run.`);
    const results = [];

    for (const task of tasks) {
      let toolResult: string = "";
      let newStatus: string = "failed";
      let errorMessage: string | null = null;

      try {
        if (task.action === "fanOn") {
          toolResult = await fanOn.invoke(task.params) as string;
          newStatus = "completed";
        } else if (task.action === "fanOff") {
          toolResult = await fanOff.invoke(task.params) as string;
          newStatus = "completed";
        } else {
          toolResult = `Unsupported action: ${task.action}`;
          errorMessage = toolResult;
        }
      } catch (err: any) {
        toolResult = `Error executing task '${task.action}': ${err.message || err}`;
        errorMessage = toolResult;
      }

      results.push({
        id: task.id,
        action: task.action,
        result: toolResult,
        status: newStatus,
      });

      // Delete task from Supabase
      const { error: deleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id);

      if (deleteError) {
        console.error(`Error deleting task ${task.id}:`, deleteError);
        // We don't return an error here as other tasks might still succeed
      }
    }

    return new Response(JSON.stringify({ message: "Scheduled tasks processed", results }), { status: 200 });

  } catch (err: any) {
    console.error("Unhandled error in /api/agent/cron:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
} 