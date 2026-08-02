import { describe, expect, it } from "vitest";
import { extensionForMime, isSafeProgressPhotoFileName } from "@/lib/uploads";

describe("Fortschrittsfotos", () => {
  it("akzeptiert nur sichere Dateinamen und erlaubte Formate", () => {
    expect(isSafeProgressPhotoFileName("11111111-1111-4111-8111-111111111111.jpg")).toBe(true);
    expect(isSafeProgressPhotoFileName("../secret.png")).toBe(false);
    expect(isSafeProgressPhotoFileName("photo.jpg")).toBe(false);
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/gif")).toBeNull();
  });
});
