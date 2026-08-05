import type { CheckResult, PillarResult, ScrapedPage } from "@/types/audit";
import { POINTS, PILLAR_MAX } from "@/lib/utils";
import { fetchRobotsTxt, parseAiCrawlerText } from "@/lib/robots";

const SCHEMA_SNIPPET_MAX = 800;

const RECOMMENDED_LOCALBUSINESS_SNIPPET = `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "YOUR BUSINESS NAME",
  "description": "What you do and who it is for",
  "url": "https://your-site.example",
  "telephone": "+1-555-555-5555"
}`;

// LocalBusiness subtypes are not enumerable from schema.org without its full type
// graph, so identity detection is exact matches for Organization/LocalBusiness plus
// this curated set of the local-business types small sites most commonly mark up.
const LOCAL_BUSINESS_SUBTYPES = new Set([
  "Restaurant",
  "CafeOrCoffeeShop",
  "FastFoodRestaurant",
  "Bakery",
  "FoodEstablishment",
  "BarOrPub",
  "Brewery",
  "IceCreamShop",
  "Store",
  "ClothingStore",
  "BookStore",
  "ShoeStore",
  "JewelryStore",
  "ElectronicsStore",
  "FurnitureStore",
  "HomeGoodsStore",
  "HardwareStore",
  "GardenStore",
  "DepartmentStore",
  "ConvenienceStore",
  "Florist",
  "PetStore",
  "BikeStore",
  "ToyStore",
  "AutoDealer",
  "SportingGoodsStore",
  "MusicStore",
  "DiscountStore",
  "LiquorStore",
  "MedicalClinic",
  "DentalClinic",
  "Hospital",
  "Pharmacy",
  "HairSalon",
  "NailSalon",
  "BeautySalon",
  "Barbershop",
  "DaySpa",
  "HealthAndBeautyBusiness",
  "Optician",
  "TattooParlor",
  "Gym",
  "HealthClub",
  "ProfessionalService",
  "AccountingService",
  "LawFirm",
  "InsuranceAgency",
  "RealEstateAgent",
  "FinancialService",
  "TravelAgency",
  "EmploymentAgency",
  "Notary",
  "DryCleaningOrLaundry",
  "MovingCompany",
  "ChildCare",
  "DayCare",
  "VeterinaryCare",
  "HomeAndConstructionBusiness",
  "GeneralContractor",
  "Electrician",
  "Plumber",
  "Locksmith",
  "AutoRepair",
  "AutoBodyShop",
  "AutoWash",
  "GasStation",
  "Hotel",
  "Motel",
  "BedAndBreakfast",
  "Hostel",
  "Resort",
  "LodgingBusiness",
  "MovieTheater",
  "BowlingAlley",
  "NightClub",
  "InternetCafe",
  "SelfStorage",
]);

export function checkAiCrawlerAccess(robotsTxt: string | null): CheckResult {
  const pointsPossible = POINTS.structuralAnswerability.aiCrawlerAccess;
  try {
    if (robotsTxt === null) {
      return {
        id: "ai-crawler-access",
        label: "AI crawler access",
        pointsEarned: pointsPossible,
        pointsPossible,
        finding:
          "No robots.txt file was found, so AI search engines are allowed to read this site by default.",
        evidence: {
          type: "absence",
          source: "/robots.txt",
          note: "No robots.txt found, so no AI crawlers are blocked.",
        },
        severity: "pass",
        status: "complete",
      };
    }

    const access = parseAiCrawlerText(robotsTxt);

    if (access.blockedAll) {
      return {
        id: "ai-crawler-access",
        label: "AI crawler access",
        pointsEarned: 0,
        pointsPossible,
        finding:
          "robots.txt blocks all crawlers with Disallow: /, which also blocks every AI search engine.",
        evidence: {
          type: "code",
          source: "/robots.txt",
          snippet: access.relevantLines.join("\n") || robotsTxt.trim(),
        },
        severity: "critical",
        status: "complete",
      };
    }

    if (access.blockedBots.length > 0) {
      return {
        id: "ai-crawler-access",
        label: "AI crawler access",
        pointsEarned: 5,
        pointsPossible,
        finding: `robots.txt blocks some AI crawlers (${access.blockedBots.join(
          ", ",
        )}), so AI answers may miss this site.`,
        evidence: {
          type: "code",
          source: "/robots.txt",
          snippet: access.relevantLines.join("\n") || robotsTxt.trim(),
        },
        severity: "warning",
        status: "complete",
      };
    }

    return {
      id: "ai-crawler-access",
      label: "AI crawler access",
      pointsEarned: pointsPossible,
      pointsPossible,
      finding: "No AI crawler is blocked in robots.txt, so AI search engines can read this site.",
      evidence:
        access.relevantLines.length > 0
          ? { type: "code", source: "/robots.txt", snippet: access.relevantLines.join("\n") }
          : {
              type: "absence",
              source: "/robots.txt",
              note: "robots.txt contains no rules that block AI crawlers.",
            },
      severity: "pass",
      status: "complete",
    };
  } catch (error) {
    console.error("[pipeline/ai-crawler-access]", error);
    return {
      id: "ai-crawler-access",
      label: "AI crawler access",
      pointsEarned: 0,
      pointsPossible,
      finding: "The robots.txt file could not be checked.",
      evidence: { type: "absence", source: "/robots.txt", note: "Could not be checked." },
      severity: "warning",
      status: "unavailable",
      unavailableReason: "robots.txt could not be fetched.",
    };
  }
}

export function checkSchemaPresence(pages: ScrapedPage[]): CheckResult {
  const pointsPossible = POINTS.structuralAnswerability.schemaPresence;
  try {
    const businessBlocks = findBusinessIdentityBlocks(pages);

    if (businessBlocks.length === 0) {
      return {
        id: "schema-presence",
        label: "Schema markup",
        pointsEarned: 0,
        pointsPossible,
        finding:
          "No schema.org markup was found, so AI systems have no structured description of this business to work from.",
        evidence: {
          type: "absence",
          source: pages[0]?.url ?? "homepage",
          note: `Add a LocalBusiness JSON-LD block to the homepage. Recommended snippet:\n\n${RECOMMENDED_LOCALBUSINESS_SNIPPET}`,
        },
        severity: "critical",
        status: "complete",
      };
    }

    const complete = businessBlocks.find((block) => block.name && block.description);
    if (complete) {
      return {
        id: "schema-presence",
        label: "Schema markup",
        pointsEarned: pointsPossible,
        pointsPossible,
        finding: `The site has schema.org markup describing ${complete.name}, which helps AI systems identify and describe the business.`,
        evidence: {
          type: "code",
          source: complete.sourceUrl,
          snippet: truncateSnippet(complete.snippet),
        },
        severity: "pass",
        status: "complete",
      };
    }

    const found = businessBlocks[0];
    return {
      id: "schema-presence",
      label: "Schema markup",
      pointsEarned: 5,
      pointsPossible,
      finding:
        "The site has schema.org markup, but it is missing a populated name and description, so AI systems get little to work with.",
      evidence: {
        type: "code",
        source: found.sourceUrl,
        snippet: truncateSnippet(found.snippet),
      },
      severity: "warning",
      status: "complete",
    };
  } catch (error) {
    console.error("[pipeline/schema-presence]", error);
    return {
      id: "schema-presence",
      label: "Schema markup",
      pointsEarned: 0,
      pointsPossible,
      finding: "Schema markup could not be checked.",
      evidence: { type: "absence", source: "homepage", note: "Could not be checked." },
      severity: "warning",
      status: "unavailable",
      unavailableReason: "Scraped schema data could not be read.",
    };
  }
}

type FoundBlock = {
  name: string | null;
  description: string | null;
  snippet: string;
  sourceUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTypeTokens(value: Record<string, unknown>): string[] {
  const type = value["@type"];
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((t): t is string => typeof t === "string");
  return [];
}

function getStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isBusinessIdentityType(tokens: string[]): boolean {
  return tokens.some(
    (token) =>
      token === "Organization" ||
      token === "LocalBusiness" ||
      LOCAL_BUSINESS_SUBTYPES.has(token),
  );
}

function collectCandidates(
  pages: ScrapedPage[],
): { block: unknown; sourceUrl: string }[] {
  const candidates: { block: unknown; sourceUrl: string }[] = [];
  for (const page of pages) {
    for (const block of page.jsonLdBlocks) {
      if (Array.isArray(block)) {
        for (const item of block) candidates.push({ block: item, sourceUrl: page.url });
      } else if (isRecord(block)) {
        const graph = block["@graph"];
        if (Array.isArray(graph)) {
          for (const item of graph) candidates.push({ block: item, sourceUrl: page.url });
        }
        candidates.push({ block, sourceUrl: page.url });
      }
    }
  }
  return candidates;
}

function findBusinessIdentityBlocks(pages: ScrapedPage[]): FoundBlock[] {
  const found: FoundBlock[] = [];
  for (const { block, sourceUrl } of collectCandidates(pages)) {
    if (!isRecord(block)) continue;
    if (!isBusinessIdentityType(getTypeTokens(block))) continue;
    found.push({
      name: getStringField(block, "name"),
      description: getStringField(block, "description"),
      snippet: jsonStringifyBlock(block),
      sourceUrl,
    });
  }
  return found;
}

function jsonStringifyBlock(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncateSnippet(snippet: string): string {
  return snippet.length > SCHEMA_SNIPPET_MAX
    ? `${snippet.slice(0, SCHEMA_SNIPPET_MAX)}…`
    : snippet;
}

export async function runStructuralAnswerability(
  origin: string,
  pages: ScrapedPage[],
): Promise<PillarResult> {
  const robotsTxt = await fetchRobotsTxt(origin);
  const checks: CheckResult[] = [
    checkAiCrawlerAccess(robotsTxt),
    checkSchemaPresence(pages),
  ];
  const pointsEarned = checks.reduce((sum, check) => sum + check.pointsEarned, 0);
  return {
    key: "structuralAnswerability",
    label: "Structural Answerability",
    status: "complete",
    pointsEarned,
    pointsPossible: PILLAR_MAX.structuralAnswerability,
    checks,
  };
}