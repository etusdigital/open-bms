/**
 * Validates a DB-IP MMDB file (Lite or Full) by opening it with the same
 * `mmdb-reader` the geolocation service uses, then asserting that a set of
 * known-good IPs resolve to expected ASN / user_type / ASN-org substrings.
 *
 * Complements the DB-IP API's MD5/SHA1 checksums — those prove the download
 * is uncorrupted; this proves the file still classifies the IPs that the
 * event-process BotDetector keys off (Google/Microsoft/Yahoo mail scanners).
 *
 * Usage:
 *   pnpm tsx scripts/validate-mmdb.ts [--min-size BYTES] [--max-size BYTES] \
 *     <mmdb-path> <fixtures-path>
 *
 * Default size bounds target the DB-IP Full dataset (500 MB .. 3 GB). Use
 * --min-size / --max-size to validate the Lite dataset (~125 MB) or other
 * tiers without losing the corruption guard.
 *
 * Exit codes:
 *   0 — all fixtures passed
 *   1 — one or more fixtures failed (stderr has detail)
 *   2 — invalid arguments, unreadable file, or file size out of bounds
 *   3 — mmdb-reader could not parse the file
 */

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import MMDBReader from 'mmdb-reader';

interface FixtureExpectation {
  // Trait assertions — only meaningful for DB-IP Full / MaxMind ISP+ tiers.
  asn?: number;
  user_type?: string;
  asn_org_contains?: string;
  // Location assertions — usable on every tier (Lite, Full, MaxMind City).
  country?: string; // ISO code, exact match
  region_iso?: string; // first subdivision ISO code, exact match (Full/MaxMind only — Lite does not populate)
  region_name_contains?: string; // case-insensitive substring on subdivisions[0].names.en (works on Lite)
  city_contains?: string; // case-insensitive substring on city.names.en
}

interface Fixture {
  ip: string;
  expect: FixtureExpectation;
}

interface TraitsRaw {
  autonomous_system_number?: number;
  autonomous_system_organization?: string;
  user_type?: string;
}

interface LookupResult {
  country?: { iso_code?: string };
  subdivisions?: Array<{ iso_code?: string; names?: { en?: string } }>;
  city?: { names?: { en?: string } };
  traits?: TraitsRaw;
}

const DEFAULT_MIN_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB (DB-IP Full)
const DEFAULT_MAX_SIZE_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB

function die(code: number, message: string): never {
  process.stderr.write(`validate-mmdb: ${message}\n`);
  process.exit(code);
}

interface ParsedArgs {
  mmdbPath: string;
  fixturesPath: string;
  minSize: number;
  maxSize: number;
}

function parseSize(raw: string, flag: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    die(2, `${flag} expects a positive integer (bytes), got "${raw}"`);
  }
  return value;
}

function parseArgs(argv: string[]): ParsedArgs {
  let minSize = DEFAULT_MIN_SIZE_BYTES;
  let maxSize = DEFAULT_MAX_SIZE_BYTES;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--min-size') {
      const next = argv[++i];
      if (!next) die(2, '--min-size requires a value');
      minSize = parseSize(next, '--min-size');
    } else if (token.startsWith('--min-size=')) {
      minSize = parseSize(token.slice('--min-size='.length), '--min-size');
    } else if (token === '--max-size') {
      const next = argv[++i];
      if (!next) die(2, '--max-size requires a value');
      maxSize = parseSize(next, '--max-size');
    } else if (token.startsWith('--max-size=')) {
      maxSize = parseSize(token.slice('--max-size='.length), '--max-size');
    } else if (token.startsWith('--')) {
      die(2, `unknown flag "${token}"`);
    } else {
      positional.push(token);
    }
  }

  if (positional.length !== 2) {
    die(
      2,
      'usage: validate-mmdb.ts [--min-size BYTES] [--max-size BYTES] <mmdb-path> <fixtures-path>',
    );
  }
  if (minSize > maxSize) {
    die(2, `--min-size (${minSize}) must be <= --max-size (${maxSize})`);
  }

  return {
    mmdbPath: resolve(positional[0]),
    fixturesPath: resolve(positional[1]),
    minSize,
    maxSize,
  };
}

function main(): void {
  const { mmdbPath, fixturesPath, minSize, maxSize } = parseArgs(process.argv.slice(2));

  let size: number;
  try {
    size = statSync(mmdbPath).size;
  } catch (err) {
    die(2, `cannot stat MMDB file at ${mmdbPath}: ${(err as Error).message}`);
  }
  if (size < minSize || size > maxSize) {
    die(2, `implausible MMDB size: ${size} bytes (expected ${minSize}..${maxSize})`);
  }

  let reader: MMDBReader;
  try {
    reader = new MMDBReader(readFileSync(mmdbPath));
  } catch (err) {
    die(3, `mmdb-reader failed to parse file: ${(err as Error).message}`);
  }

  let fixtures: Fixture[];
  try {
    fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  } catch (err) {
    die(2, `cannot read fixtures at ${fixturesPath}: ${(err as Error).message}`);
  }
  const failures: string[] = [];

  for (const fixture of fixtures) {
    const result = reader.lookup(fixture.ip) as LookupResult | null;
    const traits = result?.traits;
    const actual = {
      asn: traits?.autonomous_system_number,
      user_type: traits?.user_type,
      asn_org: traits?.autonomous_system_organization ?? '',
      country: result?.country?.iso_code ?? '',
      region_iso: result?.subdivisions?.[0]?.iso_code ?? '',
      region_name: result?.subdivisions?.[0]?.names?.en ?? '',
      city: result?.city?.names?.en ?? '',
    };

    const errors: string[] = [];
    if (fixture.expect.asn !== undefined && actual.asn !== fixture.expect.asn) {
      errors.push(`asn expected=${fixture.expect.asn} actual=${actual.asn ?? 'undefined'}`);
    }
    if (
      fixture.expect.user_type !== undefined &&
      actual.user_type !== fixture.expect.user_type
    ) {
      errors.push(
        `user_type expected="${fixture.expect.user_type}" actual="${actual.user_type ?? ''}"`,
      );
    }
    if (
      fixture.expect.asn_org_contains !== undefined &&
      !actual.asn_org.toLowerCase().includes(fixture.expect.asn_org_contains.toLowerCase())
    ) {
      errors.push(
        `asn_org expected to contain "${fixture.expect.asn_org_contains}" actual="${actual.asn_org}"`,
      );
    }
    if (fixture.expect.country !== undefined && actual.country !== fixture.expect.country) {
      errors.push(`country expected="${fixture.expect.country}" actual="${actual.country}"`);
    }
    if (
      fixture.expect.region_iso !== undefined &&
      actual.region_iso !== fixture.expect.region_iso
    ) {
      errors.push(
        `region_iso expected="${fixture.expect.region_iso}" actual="${actual.region_iso}"`,
      );
    }
    if (
      fixture.expect.region_name_contains !== undefined &&
      !actual.region_name
        .toLowerCase()
        .includes(fixture.expect.region_name_contains.toLowerCase())
    ) {
      errors.push(
        `region_name expected to contain "${fixture.expect.region_name_contains}" actual="${actual.region_name}"`,
      );
    }
    if (
      fixture.expect.city_contains !== undefined &&
      !actual.city.toLowerCase().includes(fixture.expect.city_contains.toLowerCase())
    ) {
      errors.push(
        `city expected to contain "${fixture.expect.city_contains}" actual="${actual.city}"`,
      );
    }

    if (errors.length > 0) {
      failures.push(`  ${fixture.ip}: ${errors.join('; ')}`);
    }
  }

  if (failures.length > 0) {
    process.stderr.write(
      `validate-mmdb: ${failures.length} of ${fixtures.length} fixtures failed:\n${failures.join('\n')}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `validate-mmdb: ${fixtures.length} fixtures passed (size=${size} bytes)\n`,
  );
}

main();
