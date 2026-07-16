import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const safeEvent = {
    webhook_type: typeof body?.webhook_type === "string" ? body.webhook_type : null,
    webhook_code: typeof body?.webhook_code === "string" ? body.webhook_code : null,
    item_id: typeof body?.item_id === "string" ? body.item_id : null,
    error_code: typeof body?.error?.error_code === "string" ? body.error.error_code : null,
  };
  console.info("Plaid webhook", safeEvent);
  // TODO: Add webhook-driven refresh after persistent encrypted token storage,
  // background transaction sync, and user authentication are implemented.
  return NextResponse.json({ received: true });
}
