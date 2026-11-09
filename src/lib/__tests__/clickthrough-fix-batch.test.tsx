/**
 * Fix batch from Emily's click through (Nov 9): Properties cards to the
 * PropertiesList board, the property page photo header, Direct Bookings card
 * photos, the Where field, the one home reply sentence, the referral source
 * warning, Vendors out of every left menu and the daily Home banner photo.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PropertyListCard } from "@/components/property/PropertyListCard";
import { HomePhoto, homePhotoUrl } from "@/components/property/HomePhoto";
import { homeFactsLine, openTicketsChip, ticketCountLine } from "@/lib/property-card";
import {
  DB_COPY,
  DEFAULT_REPLY_TEMPLATE,
  fillTemplate,
  referralSourceWarning,
  replyIntro,
  replyValues,
  searchFailureMessage,
} from "@/lib/direct-bookings";
import { capabilitiesFor, type AccessSeats, type AppRole, type Capability } from "@/lib/permissions";
import { canOpenPath } from "@/lib/route-access";
import { onboardingOnlyMenu, operationsMenu, type MenuGroup, type NavAccess } from "@/lib/shell-nav";
import { ALL_DATABASES, databaseMode } from "@/lib/databases";
import { bannerCaption, centralDayNumber, dailyHomePhoto, type BannerHome } from "@/lib/daily-home-photo";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const card = (o: Partial<Parameters<typeof PropertyListCard>[0]> = {}) =>
  renderToStaticMarkup(
    <PropertyListCard
      address="815 E Fulton St"
      photoUrl="https://example.test/medium.jpg"
      stage="Operations"
      onboarding={false}
      place="Broken Arrow, OK"
      facts="4 bd · 3 ba · sleeps 8 · Rose District"
      activeOwner
      labels={[{ id: "l1", name: "30-day firm" }]}
      carried={2}
      openTickets={2}
      totalTickets={5}
      {...o}
    />,
  );

describe("1. Properties list card, as the board", () => {
  it("photo at the top: the home's photo, fixed height, cropped, lazy, address as alt text", () => {
    const html = card();
    expect(html).toContain('src="https://example.test/medium.jpg"');
    expect(html).toContain('alt="815 E Fulton St"');
    expect(html).toContain('loading="lazy"');
    expect(html).toMatch(/<div class="relative h-44 w-full shrink-0"><img[^>]*class="object-cover h-full w-full"/);
  });

  it("the stage and open tickets chips sit over the photo's top edge", () => {
    const html = card();
    const overPhoto = html.slice(html.indexOf('data-part="photo-chips"'), html.indexOf('data-part="address"'));
    expect(overPhoto).toContain("Operations");
    expect(overPhoto).toContain("2 open tickets");
    expect(overPhoto).not.toContain("Active Owner");
    expect(card({ openTickets: 0 })).not.toContain("open tickets</span>");
  });

  it("then, in this order: address in bold, City, State, the facts line, the chips row, the ticket line", () => {
    const html = card();
    const order = [
      'data-part="photo-chips"',
      'data-part="address" class="text-base font-semibold',
      ">815 E Fulton St<",
      "Broken Arrow, OK",
      "4 bd · 3 ba · sleeps 8 · Rose District",
      'data-part="chips"',
      "Active Owner",
      "30-day firm",
      "2 carried over",
      "2 open tickets · 5 total",
    ].map((s) => html.indexOf(s));
    for (const i of order) expect(i).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("wording of the lines", () => {
    expect(homeFactsLine({ bedrooms: 4, bathrooms: 3, max_guests: 8, neighborhood: "Rose District" })).toBe(
      "4 bd · 3 ba · sleeps 8 · Rose District",
    );
    expect(homeFactsLine({ bedrooms: 3, bathrooms: null, max_guests: null, neighborhood: " " })).toBe("3 bd");
    expect(openTicketsChip(1)).toBe("1 open ticket");
    expect(openTicketsChip(0)).toBeNull();
    expect(ticketCountLine(1, 1)).toBe("1 open ticket · 1 total");
    expect(ticketCountLine(0, 7)).toBe("0 open tickets · 7 total");
    expect(ticketCountLine(0, 0)).toBeNull();
    expect(card({ openTickets: 0, totalTickets: 0 })).not.toContain('data-part="tickets"');
  });

  it("no chips row when there is nothing to show", () => {
    expect(card({ activeOwner: false, labels: [], carried: 0 })).not.toContain('data-part="chips"');
  });

  it("a home with no photo shows a plain neutral block, never a broken image", () => {
    for (const url of [null, ""]) {
      const html = card({ photoUrl: url });
      expect(html).not.toContain("<img");
      expect(html).toContain('data-photo="none"');
      expect(html).toContain("bg-muted");
    }
    expect(renderToStaticMarkup(<HomePhoto url={null} alt="x" />)).toBe('<div aria-hidden="true" data-photo="none" class="bg-muted"></div>');
  });

  it("the medium photo is used first, then the full photo", () => {
    expect(homePhotoUrl({ primary_photo_medium_url: "m", primary_photo_url: "f" })).toBe("m");
    expect(homePhotoUrl({ primary_photo_medium_url: null, primary_photo_url: "f" })).toBe("f");
    expect(homePhotoUrl({ primary_photo_medium_url: null, primary_photo_url: null })).toBeNull();
  });

  it("the page uses the card: one across on a phone, three on a wide screen, Admin pick box kept", () => {
    const page = read("routes/_authenticated/properties.tsx");
    expect(page).toContain("<PropertyListCard");
    expect(page).toContain('className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"');
    expect(page).toContain("photoUrl={h.photo}");
    expect(page).toContain("photo: homePhotoUrl(p)");
    expect(page).toContain("totalTickets: all.length");
    expect(page).toContain("Add a label to many homes");
    expect(page).toContain("aria-label={`Pick ${h.title}`}");
  });
});

describe("2. Property page photo header", () => {
  it("the header shows the home's photo, and nothing when there is none", () => {
    const page = read("routes/_authenticated/property.$propertyId.tsx");
    const header = page.slice(page.indexOf("function PropertyHeader"));
    expect(header).toContain("{p.photoUrl ? (");
    expect(header).toContain("<HomePhoto");
    expect(header.indexOf("<h1")).toBeGreaterThan(header.indexOf("<HomePhoto"));
    // The stage chip and the other chips stay as built.
    expect(header).toContain("{stageLabel(p.lifecycleStatus)}</StatusBadge>");
  });
});

describe("3. Direct Bookings home cards show the photo", () => {
  it("the search passes the photo it already reads to the cards", () => {
    const fn = read("lib/direct-bookings.functions.ts");
    expect(fn).toContain("photo: h.imageUrl ?? null,");
    const page = read("routes/_authenticated/direct-bookings.$requestId.tsx");
    const cards = page.slice(page.indexOf('data-card="home"'), page.indexOf("function HomesMap"));
    expect(cards).toContain("<HomePhoto url={h.photo}");
    // Photo first, then number, address, facts, price, free from line and Pick, as built.
    const order = ["<HomePhoto", "{i + 1}", "{h.name}", "miles away", "a month", "{h.tag}", '"Pick"'].map((s) => cards.indexOf(s));
    for (const i of order) expect(i).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("4. The Where field", () => {
  it("label, placeholder and help line", () => {
    expect(DB_COPY.whereLabel).toBe("City, ZIP or street address");
    expect(DB_COPY.wherePlaceholder).toBe("For example: Broken Arrow, 74012, or 815 E Fulton St");
    expect(DB_COPY.whereHelp).toBe(
      "We find the homes closest to this place. If you fill in Near this address, we use that instead.",
    );
    for (const f of ["routes/_authenticated/direct-bookings.index.tsx", "routes/_authenticated/direct-bookings.$requestId.tsx"]) {
      const src = read(f);
      expect(src).toContain("DB_COPY.whereLabel");
      expect(src).toContain("DB_COPY.wherePlaceholder");
      expect(src).toContain("DB_COPY.whereHelp");
      expect(src).not.toContain('"Where"');
    }
  });

  it("a place that cannot be read, a busy place search, and real calendar errors", () => {
    expect(searchFailureMessage(new Error("We could not locate that place. Try a fuller address or ZIP code."))).toBe(
      "We could not locate that place. Try a fuller address or ZIP code.",
    );
    expect(searchFailureMessage(new Error("Google Maps quota reached. Try again later."))).toBe(
      "The place search is busy. Try again in a minute.",
    );
    expect(searchFailureMessage(new Error("Google Maps lookup failed [429]."))).toBe("The place search is busy. Try again in a minute.");
    expect(searchFailureMessage(new Error("OwnerRez returned too many reservations to verify this property. Narrow the dates."))).toBe(
      "We could not check calendars. Try again.",
    );
    expect(read("lib/direct-bookings.functions.ts")).toContain("message: searchFailureMessage(err)");
  });
});

describe("5. Reply wording and the referral source warning", () => {
  const home = { name: "A", address: "1 A St", link: null, distanceMiles: 1, bedrooms: 3, bathrooms: 2, availability: "Now", monthly: 5390, nightly: 180 };
  const fees = { cleaningFee: 350, applicationFee: 89, petFeePerDog: 250, dogs: 0, deposit: 1500 };
  const body = (n: number) =>
    fillTemplate(
      DEFAULT_REPLY_TEMPLATE,
      replyValues({ contactName: "Pat", senderName: "Sam", subject: "x", dates: "", homes: Array.from({ length: n }, () => home), fees, addressGiven: false }),
    );

  it("one home: the new sentence; two or three homes keep their opening", () => {
    expect(replyIntro(1)).toBe(
      "This is the best option we have for you right now. If you would like the chance to view more homes, please let us know.",
    );
    expect(body(1)).toContain("Hello Pat,\n\nThis is the best option we have for you right now. If you would like the chance to view more homes, please let us know.\n\nAddress: 1 A St");
    for (const n of [2, 3]) {
      expect(replyIntro(n)).toBe("Here are the homes we can offer:");
      expect(body(n)).toContain("Here are the homes we can offer:\n\nAddress: 1 A St");
    }
    expect(read("lib/direct-bookings.ts")).not.toContain("we only have this home available");
  });

  it("no referral source: a plain warning on the reply step and for the approver; sending is not blocked", () => {
    expect(referralSourceWarning(null)).toBe("Choose the referral source so the fees are included before you send.");
    expect(referralSourceWarning("")).toBe("Choose the referral source so the fees are included before you send.");
    expect(referralSourceWarning("8f0e0f9e-0000-4000-8000-000000000000")).toBeNull();
    const page = read("routes/_authenticated/direct-bookings.$requestId.tsx");
    const approval = page.slice(page.indexOf("function ApprovalBanner"), page.indexOf("function AskedFor"));
    expect(approval).toContain("referralSourceWarning(d.lead.inquiry_source_id)");
    const reply = page.slice(page.indexOf("function ReplySection"));
    expect(reply).toContain("const sourceWarning = referralSourceWarning(lead.inquiry_source_id);");
    expect(reply).toContain("disabled={busy || picked.length === 0 || !to}");
  });
});

describe("6. Vendors is in no left menu, the page still opens", () => {
  const PROFILES: Record<string, { roles: AppRole[]; seats: AccessSeats }> = {
    "Property Coordinator": { roles: ["tech"], seats: {} },
    "Operations Supervisor": { roles: ["manager"], seats: { opsSupervisor: true } },
    "Director of Operations": { roles: ["manager"], seats: { opsDirector: true } },
    "Director of Onboarding": { roles: ["onboarding"], seats: { onboardingDirector: true } },
    "Project Manager": { roles: ["onboarding"], seats: { projectManager: true } },
    Utilities: { roles: ["onboarding"], seats: { utilities: true } },
    Design: { roles: ["onboarding"], seats: {} },
    "Finance lead": { roles: ["manager"], seats: { finance: true } },
    Admin: { roles: ["admin"], seats: {} },
  };
  const menus = (p: { roles: AppRole[]; seats: AccessSeats }): MenuGroup[] => {
    const access: NavAccess = {
      can: (c: Capability) => capabilitiesFor(p.roles, p.seats).has(c),
      canOpen: (path: string) => canOpenPath(path, p),
      flagEnabled: () => true,
    };
    return [...operationsMenu(access), ...onboardingOnlyMenu(access)];
  };

  for (const [name, p] of Object.entries(PROFILES)) {
    it(`${name}: no Vendors in any menu; the Vendors page opens by address and from the Databases card when allowed`, () => {
      const groups = menus(p);
      expect(groups.flatMap((g) => g.items.map((i) => i.to))).not.toContain("/vendors");
      expect(groups.flatMap((g) => [g.label, ...g.items.map((i) => i.label)])).not.toContain("Vendors");
      const opens = canOpenPath("/vendors", p);
      // The Vendors card in Databases opens the page for exactly the people the page lets in.
      expect(databaseMode("vendors", p) !== "hidden").toBe(opens);
      if (name !== "Design") expect(opens).toBe(true);
    });
  }

  it("the Databases card still opens the Vendors page", () => {
    expect(ALL_DATABASES.find((c) => c.key === "vendors")?.page).toBe("/vendors");
    expect(read("routes/_authenticated/databases.index.tsx")).toContain('void navigate({ to: "/vendors", search: {} })');
  });
});

describe("7. Home banner: a real home's photo that changes daily", () => {
  const homes: BannerHome[] = [
    { id: "c", photo: "https://example.test/c.jpg", name: "3 C St", city: "Tulsa" },
    { id: "a", photo: "https://example.test/a.jpg", name: "1 A St", city: "Broken Arrow" },
    { id: "b", photo: "https://example.test/b.jpg", name: "2 B St", city: null },
  ];

  it("the same home for everyone on a given Central day, whatever the order of the list", () => {
    const noon = new Date("2026-11-09T18:00:00Z");
    const lateEvening = new Date("2026-11-10T05:30:00Z"); // 11:30 PM Central, still Nov 9
    expect(centralDayNumber(lateEvening)).toBe(centralDayNumber(noon));
    expect(dailyHomePhoto(homes, noon)).toEqual(dailyHomePhoto([...homes].reverse(), lateEvening));
  });

  it("changes with the date", () => {
    const days = [0, 1, 2].map((d) => dailyHomePhoto(homes, new Date(Date.UTC(2026, 10, 9 + d, 18)))!.id);
    expect(new Set(days).size).toBe(3);
    expect(dailyHomePhoto(homes, new Date(Date.UTC(2026, 10, 12, 18)))!.id).toBe(days[0]!);
  });

  it("only homes with a photo; none means the stock picture", () => {
    expect(dailyHomePhoto([{ id: "x", photo: "", name: "X", city: null }], new Date())).toBeNull();
    expect(dailyHomePhoto([], new Date())).toBeNull();
  });

  it("caption: the home's name and city", () => {
    expect(bannerCaption(homes[1]!)).toBe("1 A St, Broken Arrow");
    expect(bannerCaption(homes[2]!)).toBe("2 B St");
  });

  it("the Home page shows it with its caption and falls back to the stock picture", () => {
    const page = read("routes/_authenticated/dashboard.tsx");
    expect(page).toContain("dailyHomePhoto(bannerHomes.data ?? [], new Date())");
    expect(page).toContain("image={bannerHome?.photo ?? (bannerHomes.isLoading ? undefined : heroImage)}");
    expect(page).toContain("imageCaption={bannerHome ? bannerCaption(bannerHome) : undefined}");
    expect(page).toContain("onImageError={bannerHome ? () => setBannerFailed(true) : undefined}");
  });
});

describe("words", () => {
  it("no seat and no long dash in the new screen words", () => {
    const words = [
      DB_COPY.whereLabel, DB_COPY.wherePlaceholder, DB_COPY.whereHelp, DB_COPY.placeNotFound,
      DB_COPY.placeSearchBusy, DB_COPY.noReferralSource, replyIntro(1),
      card(), read("components/property/PropertyListCard.tsx"), read("lib/property-card.ts"),
    ];
    for (const w of words) {
      expect(w).not.toMatch(/\bseat\b/i);
      expect(w).not.toContain("\u2014");
    }
  });
});
