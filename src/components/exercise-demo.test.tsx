import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseDiagram } from "@/components/exercise-demo";

describe("Übungsspezifische Bewegungsdiagramme", () => {
  it.each([
    ["goblet-squat", "Goblet Squat", "diagram-weight"],
    ["bent-over-row", "Vorgebeugtes Rudern", "diagram-weight"],
    ["lying-leg-raise", "Beinheben im Liegen", "diagram-core"],
  ])("rendert für %s eine eigene, beschriftete SVG-Techniktafel", (slug, accessibleName, distinguishingClass) => {
    const markup = renderToStaticMarkup(<ExerciseDiagram slug={slug} />);
    expect(markup).toContain(`data-exercise="${slug}"`);
    expect(markup).toContain(`aria-label="${accessibleName}`);
    expect(markup).toContain(distinguishingClass);
    expect(markup).toContain("START");
    expect(markup).toContain("ENDE");
  });

  it("verwendet für unbekannte Übungen keine generische Figur", () => {
    expect(renderToStaticMarkup(<ExerciseDiagram slug="unbekannt" />)).toBe("");
  });
});
