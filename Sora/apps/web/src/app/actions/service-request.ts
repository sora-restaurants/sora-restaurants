"use server";

import { createServiceRequest } from "../../server/service-requests.ts";
import { prodDeps } from "../../server/prod-deps.ts";

export async function serviceRequestAction(input: unknown) {
  return createServiceRequest(input, prodDeps());
}
