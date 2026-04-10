import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uploadImage } from "./api";

describe("api.uploadImage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("surfaces nested backend error message from envelope detail", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () =>
        JSON.stringify({
          detail: {
            ok: false,
            error: {
              message: "Either image or image_url must be provided."
            }
          }
        })
    });

    await expect(uploadImage(new File(["x"], "x.png", { type: "image/png" }))).rejects.toThrow(
      "Either image or image_url must be provided."
    );
  });

  it("rejects malformed success responses that miss img_id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {}
      })
    });

    await expect(uploadImage(new File(["x"], "x.png", { type: "image/png" }))).rejects.toThrow(
      "Image upload response did not include a valid image ID."
    );
  });
});
