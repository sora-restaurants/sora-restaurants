import { describe, expect, it } from "vitest";
import { newCalls } from "./call-chime.ts";

describe("newCalls", () => {
  it("stays silent on the first load, even with calls waiting", () => {
    expect(newCalls(null, ["a", "b"]).chime).toBe(false);
  });

  it("chimes once when one or several new calls arrive", () => {
    const first = newCalls(null, ["a"]);
    expect(newCalls(first.seen, ["a", "b"]).chime).toBe(true);
    expect(newCalls(first.seen, ["a", "b", "c"]).chime).toBe(true);
  });

  it("stays silent when nothing changed or calls only went away", () => {
    const { seen } = newCalls(null, ["a", "b"]);
    expect(newCalls(seen, ["a", "b"]).chime).toBe(false);
    expect(newCalls(seen, ["b"]).chime).toBe(false);
    expect(newCalls(seen, []).chime).toBe(false);
  });

  it("does not re-chime for a call answered locally that a slow poll returns", () => {
    let { seen } = newCalls(null, []);
    ({ seen } = newCalls(seen, ["a"]));
    ({ seen } = newCalls(seen, [])); // hidden by "On my way"
    expect(newCalls(seen, ["a"]).chime).toBe(false);
  });

  it("chimes for a later call once the first load has happened with none waiting", () => {
    const { seen } = newCalls(null, []);
    expect(newCalls(seen, ["x"]).chime).toBe(true);
  });
});
