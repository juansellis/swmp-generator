/**
 * Unit tests for dashboard distinct metrics (no double counting).
 * Run: npx tsx lib/dashboardMetrics.test.ts
 */

import { aggregateDistinctMetrics, streamDistinctKey } from "./dashboardMetrics";

function run(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    console.error(`  ✗ ${label}`);
    throw e;
  }
}

console.log("Dashboard metrics (distinct counts)\n");

// Two projects both with Metal => Total Waste Streams counts Metal once
run("Two projects both with Metal => Total Waste Streams = 1 (Metal counted once)", () => {
  const rows = [
    { inputs: { waste_streams: ["Metal", "Mixed C&D"], waste_stream_plans: [] } },
    { inputs: { waste_streams: ["Metal", "Timber (untreated)"], waste_stream_plans: [] } },
  ];
  const { totalWasteStreamsConfigured } = aggregateDistinctMetrics(rows);
  if (totalWasteStreamsConfigured !== 3) {
    throw new Error(`Expected 3 unique streams (metal, mixed c&d, timber), got ${totalWasteStreamsConfigured}`);
  }
  // Metal appears in both but distinct key "metal" is one; plus "mixed c&d", "timber (untreated)" = 3
});

run("Two projects both only Metal => Total Waste Streams = 1", () => {
  const rows = [
    { inputs: { waste_streams: ["Metal"], waste_stream_plans: [] } },
    { inputs: { waste_streams: ["Metal"], waste_stream_plans: [] } },
  ];
  const { totalWasteStreamsConfigured } = aggregateDistinctMetrics(rows);
  if (totalWasteStreamsConfigured !== 1) {
    throw new Error(`Expected 1 unique stream (Metal), got ${totalWasteStreamsConfigured}`);
  }
});

// Two projects using same facility => Facilities utilised = 1
run("Two projects using same facility_id => Facilities utilised = 1", () => {
  const facilityId = "akl-metals-1";
  const rows = [
    {
      inputs: {
        waste_streams: ["Metal"],
        waste_stream_plans: [{ category: "Metal", facility_id: facilityId }],
      },
    },
    {
      inputs: {
        waste_streams: ["Metal"],
        waste_stream_plans: [{ category: "Metal", facility_id: facilityId }],
      },
    },
  ];
  const { facilitiesLinked } = aggregateDistinctMetrics(rows);
  if (facilitiesLinked !== 1) {
    throw new Error(`Expected 1 unique facility, got ${facilitiesLinked}`);
  }
});

run("Two projects with two different facilities => Facilities utilised = 2", () => {
  const rows = [
    {
      inputs: {
        waste_streams: ["Metal"],
        waste_stream_plans: [{ category: "Metal", facility_id: "akl-metals-1" }],
      },
    },
    {
      inputs: {
        waste_streams: ["Metal"],
        waste_stream_plans: [{ category: "Metal", facility_id: "wkt-metals-1" }],
      },
    },
  ];
  const { facilitiesLinked } = aggregateDistinctMetrics(rows);
  if (facilitiesLinked !== 2) {
    throw new Error(`Expected 2 unique facilities, got ${facilitiesLinked}`);
  }
});

run("streamDistinctKey: normalises to lowercase", () => {
  if (streamDistinctKey("Metal") !== "metal") throw new Error("Metal should become metal");
  if (streamDistinctKey("  Mixed C&D  ") !== "mixed c&d") throw new Error("Trim and lower");
});

console.log("\nAll tests passed. Total Waste Streams and Facilities utilised are distinct across projects.\n");
