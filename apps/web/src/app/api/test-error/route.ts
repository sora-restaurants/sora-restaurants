export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Temporary: returns a 500 so error monitoring can be tested. Remove after the test.
export async function GET() {
  return Response.json(
    { error: "test_error", message: "Intentional 500 for error monitoring test", code: "TEST_500" },
    { status: 500 },
  );
}
