import { password, select, input, confirm, checkbox } from "@inquirer/prompts";

// Exit cleanly on Esc / Ctrl+C
process.on("uncaughtException", (error) => {
  if (error.name === "ExitPromptError") {
    console.log("\nBye.");
    process.exit(0);
  }
  throw error;
});

// ── Cloudflare API Client ──────────────────────────────────────────

const CF_API = "https://api.cloudflare.com/client/v4";
let apiToken = "";

async function cfFetch(path, opts = {}) {
  const res = await fetch(`${CF_API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  const json = await res.json();
  if (!json.success) {
    const msg = json.errors?.map((e) => `[${e.code}] ${e.message}`).join(", ") || "Unknown error";
    throw new Error(`Cloudflare API error (${opts.method || "GET"} ${path}): ${msg}`);
  }
  return json.result;
}

// ── Data Fetching & Status ─────────────────────────────────────────

async function getEmailRoutingStatus(zoneId) {
  try {
    return await cfFetch(`/zones/${zoneId}/email/routing`);
  } catch {
    return { enabled: false };
  }
}

async function getCatchAllRule(zoneId) {
  try {
    return await cfFetch(`/zones/${zoneId}/email/routing/rules/catch_all`);
  } catch {
    return null;
  }
}

async function getDnsRecords(zoneId) {
  return cfFetch(`/zones/${zoneId}/dns_records?per_page=1000`);
}

function discoverSubdomains(dnsRecords, zoneName) {
  const mxRecords = dnsRecords.filter(
    (r) => r.type === "MX" && r.content.endsWith(".mx.cloudflare.net")
  );
  const subdomains = new Map();
  for (const r of mxRecords) {
    // Include wildcard (*.zone) and regular subdomains, exclude bare zone
    if (r.name !== zoneName) {
      if (!subdomains.has(r.name)) subdomains.set(r.name, []);
      subdomains.get(r.name).push(r);
    }
  }
  return subdomains;
}

function discoverMxTargets(dnsRecords, zoneName) {
  const rootMx = dnsRecords.filter(
    (r) => r.type === "MX" && r.name === zoneName && r.content.endsWith(".mx.cloudflare.net")
  );
  if (rootMx.length > 0) {
    return rootMx.map((r) => ({ content: r.content, priority: r.priority }));
  }
  return [
    { content: "route1.mx.cloudflare.net", priority: 86 },
    { content: "route2.mx.cloudflare.net", priority: 24 },
    { content: "route3.mx.cloudflare.net", priority: 2 },
  ];
}

function formatCatchAll(rule) {
  if (!rule || !rule.enabled) return "❌ Disabled";
  const action = rule.actions?.[0];
  if (!action) return "❌ Not configured";
  if (action.type === "worker") return `→ Worker (${action.value?.[0] || "unknown"})`;
  if (action.type === "forward") return `→ Forward (${action.value?.[0] || "unknown"})`;
  return `→ ${action.type}`;
}

async function showStatus(zoneId, zoneName) {
  const [routing, catchAll, dnsRecords] = await Promise.all([
    getEmailRoutingStatus(zoneId),
    getCatchAllRule(zoneId),
    getDnsRecords(zoneId),
  ]);

  const subdomains = discoverSubdomains(dnsRecords, zoneName);

  console.log(`Zone: ${zoneName}`);
  console.log(`Email Routing: ${routing.enabled ? "✅ Enabled" : "❌ Disabled"}`);
  console.log(`Catch-all: ${formatCatchAll(catchAll)}`);

  if (subdomains.size > 0) {
    console.log("Subdomains with email routing:");
    for (const fqdn of subdomains.keys()) {
      console.log(`  ✅ ${fqdn}`);
    }
  } else {
    console.log("Subdomains: (none configured)");
  }
  console.log();

  return { routing, catchAll, dnsRecords };
}

// ── Authentication ─────────────────────────────────────────────────

async function authenticate() {
  apiToken = process.env.CF_API_TOKEN || "";
  if (!apiToken) {
    apiToken = await password({ message: "Cloudflare API Token:" });
  }
  // Validate by listing zones
  try {
    const zones = await cfFetch("/zones?per_page=50");
    return zones;
  } catch (e) {
    console.error("Authentication failed. Check your API token.");
    console.error("Required permissions: Zone:Read, DNS:Edit, Email Routing:Edit");
    process.exit(1);
  }
}

// ── Operations ─────────────────────────────────────────────────────

async function toggleEmailRouting(zoneId) {
  const status = await getEmailRoutingStatus(zoneId);
  const current = status.enabled;
  const action = current ? "disable" : "enable";

  const ok = await confirm({
    message: `Email Routing is currently ${current ? "ENABLED" : "DISABLED"}. ${current ? "Disable" : "Enable"} it?`,
  });
  if (!ok) return;

  await cfFetch(`/zones/${zoneId}/email/routing/${action}`, { method: "POST" });
  console.log(`\nEmail Routing ${action}d.`);
}

async function setCatchAll(zoneId) {
  const workerName = await input({
    message: "Worker name:",
    default: "voidbox",
  });

  // GET existing rule to preserve fields
  const existing = await getCatchAllRule(zoneId);
  const body = {
    ...existing,
    actions: [{ type: "worker", value: [workerName] }],
    matchers: [{ type: "all" }],
    enabled: true,
  };

  const ok = await confirm({
    message: `Set catch-all to Worker "${workerName}"?`,
  });
  if (!ok) return;

  await cfFetch(`/zones/${zoneId}/email/routing/rules/catch_all`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  console.log(`\nCatch-all set to Worker "${workerName}".`);
}

async function addSubdomain(zoneId, zoneName) {
  const prefix = await input({ message: "Subdomain prefix (e.g. mail4, or * for wildcard):" });
  if (!prefix.trim()) return;

  const trimmed = prefix.trim();
  if (trimmed !== "*" && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(trimmed)) {
    console.log("Invalid prefix. Use only letters, digits, hyphens, or * for wildcard.");
    return;
  }

  const fqdn = trimmed === "*" ? `*.${zoneName}` : `${trimmed}.${zoneName}`;
  if (trimmed === "*") {
    console.log(`\nConfiguring wildcard ${fqdn}...`);
    console.log("Note: wildcard MX won't apply to subdomains that already have A/AAAA records.");
  } else {
    console.log(`\nConfiguring ${fqdn}...`);
  }

  const dnsRecords = await getDnsRecords(zoneId);

  // Check if MX records already exist
  const existingMx = dnsRecords.filter(
    (r) => r.type === "MX" && r.name === fqdn && r.content.endsWith(".mx.cloudflare.net")
  );
  if (existingMx.length > 0) {
    console.log(`MX records already exist for ${fqdn}, skipping.`);
  } else {
    // Discover MX targets from root domain
    const mxTargets = discoverMxTargets(dnsRecords, zoneName);
    for (const mx of mxTargets) {
      await cfFetch(`/zones/${zoneId}/dns_records`, {
        method: "POST",
        body: JSON.stringify({
          type: "MX",
          name: fqdn,
          content: mx.content,
          priority: mx.priority,
        }),
      });
    }
    console.log(`Created ${mxTargets.length} MX record(s) for ${fqdn}.`);
  }

  // Check if SPF TXT record already exists
  const existingSpf = dnsRecords.find(
    (r) => r.type === "TXT" && r.name === fqdn && r.content.includes("v=spf1")
  );
  if (existingSpf) {
    console.log(`SPF record already exists for ${fqdn}, skipping.`);
  } else {
    await cfFetch(`/zones/${zoneId}/dns_records`, {
      method: "POST",
      body: JSON.stringify({
        type: "TXT",
        name: fqdn,
        content: "v=spf1 include:_spf.mx.cloudflare.net ~all",
      }),
    });
    console.log(`Created SPF record for ${fqdn}.`);
  }

  // Verify catch-all is configured
  const catchAll = await getCatchAllRule(zoneId);
  if (!catchAll?.enabled || catchAll.actions?.[0]?.type !== "worker") {
    console.log("\n⚠️  Catch-all is not configured to a Worker.");
    const fix = await confirm({ message: "Set catch-all to Worker now?" });
    if (fix) await setCatchAll(zoneId);
  }

  console.log(`\n✅ ${fqdn} configured.`);
}

async function removeSubdomain(zoneId, zoneName) {
  const dnsRecords = await getDnsRecords(zoneId);
  const subdomains = discoverSubdomains(dnsRecords, zoneName);

  if (subdomains.size === 0) {
    console.log("No subdomains configured.");
    return;
  }

  const fqdn = await select({
    message: "Select subdomain to remove:",
    choices: [...subdomains.keys()].map((name) => ({ name, value: name })),
  });

  const ok = await confirm({
    message: `Remove ${fqdn}? This will stop email delivery to this subdomain.`,
  });
  if (!ok) return;

  // Delete MX records
  const mxToDelete = dnsRecords.filter(
    (r) => r.type === "MX" && r.name === fqdn && r.content.endsWith(".mx.cloudflare.net")
  );
  for (const r of mxToDelete) {
    try {
      await cfFetch(`/zones/${zoneId}/dns_records/${r.id}`, { method: "DELETE" });
    } catch (e) {
      console.error(`Failed to delete MX record ${r.content}: ${e.message}`);
    }
  }

  // Delete SPF TXT record
  const spfToDelete = dnsRecords.filter(
    (r) => r.type === "TXT" && r.name === fqdn && r.content.includes("v=spf1")
  );
  for (const r of spfToDelete) {
    try {
      await cfFetch(`/zones/${zoneId}/dns_records/${r.id}`, { method: "DELETE" });
    } catch (e) {
      console.error(`Failed to delete TXT record: ${e.message}`);
    }
  }

  console.log(`\nDeleted ${mxToDelete.length} MX + ${spfToDelete.length} TXT record(s).`);

  console.log(`\n✅ ${fqdn} removed.`);
}

async function scanDomains(zones) {
  // Let user pick which zones to include
  const selectedZoneIds = await checkbox({
    message: "Select zones to scan:",
    choices: zones.map((z) => ({ name: z.name, value: z.id, checked: true })),
  });

  if (selectedZoneIds.length === 0) {
    console.log("No zones selected.");
    return;
  }

  const selectedZones = zones.filter((z) => selectedZoneIds.includes(z.id));

  console.log("Scanning selected zones...\n");
  const wildcards = [];
  const fixed = [];

  for (const zone of selectedZones) {
    const [routing, dnsRecords] = await Promise.all([
      getEmailRoutingStatus(zone.id),
      getDnsRecords(zone.id),
    ]);

    if (!routing.enabled) continue;

    fixed.push(zone.name);
    const subdomains = discoverSubdomains(dnsRecords, zone.name);
    for (const fqdn of subdomains.keys()) {
      if (fqdn.startsWith("*.")) {
        wildcards.push(fqdn);
      } else {
        fixed.push(fqdn);
      }
    }
  }

  console.log("── Fixed Domains ──");
  if (fixed.length > 0) {
    for (const d of fixed) console.log(`  ${d}`);
  } else {
    console.log("  (none)");
  }

  console.log("\n── Wildcard Domains ──");
  if (wildcards.length > 0) {
    for (const d of wildcards) console.log(`  ${d}`);
  } else {
    console.log("  (none)");
  }

  console.log(`\nTotal: ${fixed.length} fixed + ${wildcards.length} wildcard`);
}

// ── Entry Point ────────────────────────────────────────────────────

async function main() {
  console.log("Voidbox Email Routing Setup\n");
  const zones = await authenticate();

  if (zones.length === 0) {
    console.error("No zones found for this API token.");
    process.exit(1);
  }

  // Top-level menu loop
  while (true) {
    const action = await select({
      message: "What to do?",
      choices: [
        { name: "Manage zone email routing", value: "zone" },
        { name: "Scan domains", value: "scan" },
        { name: "Exit", value: "exit" },
      ],
    });

    if (action === "exit") break;

    if (action === "scan") {
      await scanDomains(zones);
      continue;
    }

    const zoneId = await select({
      message: "Select zone:",
      choices: zones.map((z) => ({ name: z.name, value: z.id })),
    });

    const zone = zones.find((z) => z.id === zoneId);
    console.log();
    await showStatus(zoneId, zone.name);

    // Zone action menu loop
    while (true) {
      const menuAction = await select({
        message: "Action:",
        choices: [
          { name: "Add subdomain", value: "add" },
          { name: "Remove subdomain", value: "remove" },
          { name: "Toggle zone email routing", value: "toggle" },
          { name: "Set catch-all → Worker", value: "catchall" },
          { name: "Refresh status", value: "refresh" },
          { name: "Back", value: "back" },
        ],
      });

      if (menuAction === "back") break;

      try {
        switch (menuAction) {
          case "add":
            await addSubdomain(zoneId, zone.name);
            break;
          case "remove":
            await removeSubdomain(zoneId, zone.name);
            break;
          case "toggle":
            await toggleEmailRouting(zoneId);
            break;
          case "catchall":
            await setCatchAll(zoneId);
            break;
          case "refresh":
            break;
        }
      } catch (e) {
        console.error(`\nError: ${e.message}\n`);
      }

      await showStatus(zoneId, zone.name);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
