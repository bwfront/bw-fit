import { describe, expect, it } from "vitest";
import { extensionForMime, extensionFromMagicBytes, isSafeProgressPhotoFileName, resolveProgressPhotoExtension } from "@/lib/uploads";

describe("Fortschrittsfotos", () => {
  it("akzeptiert nur sichere Dateinamen und erlaubte Formate", () => {
    expect(isSafeProgressPhotoFileName("11111111-1111-4111-8111-111111111111.jpg")).toBe(true);
    expect(isSafeProgressPhotoFileName("../secret.png")).toBe(false);
    expect(isSafeProgressPhotoFileName("photo.jpg")).toBe(false);
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/gif")).toBeNull();
  });

  it("erkennt Formate auch ohne MIME-Type über Name und Magic Bytes", () => {
    expect(resolveProgressPhotoExtension({ type: "", name: "IMG_001.HEIC" })).toBe("jpg");
    expect(resolveProgressPhotoExtension({ type: "", name: "shot.PNG" })).toBe("png");
    expect(extensionFromMagicBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(resolveProgressPhotoExtension({ type: "", name: "unknown.bin" }, Uint8Array.from([0xff, 0xd8, 0xff]))).toBe("jpg");
  });
});
