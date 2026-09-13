type SectionPosition = { id: string; top: number; bottom: number };

/** Side-by-side alert panels should not steal the main column's active navigation. */
export function activeSection(sections: SectionPosition[], hash: string, scrollY: number, height: number, atBottom: boolean) {
  if (scrollY < 32) return "overview";
  const boundary = height * .38;
  const requested = sections.find(section => section.id === hash);
  if (requested && requested.top <= boundary && requested.bottom > (atBottom ? 80 : boundary)) return requested.id;
  let id = "overview";
  for (const section of sections) if (section.id !== "price-alerts" && section.top <= boundary) id = section.id;
  const alerts = sections.find(section => section.id === "price-alerts");
  const watchlist = sections.find(section => section.id === "watchlist");
  if (alerts && watchlist && alerts.top >= watchlist.bottom - 1 && alerts.top <= boundary) id = alerts.id;
  return id;
}
