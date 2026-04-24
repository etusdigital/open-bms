/**
 * Validates a DB-IP Full MMDB file by opening it with the same `mmdb-reader`
 * the geolocation service uses, then asserting that a set of known-good IPs
 * resolve to expected ASN / user_type / ASN-org substrings.
 *
 * Complements the DB-IP API's MD5/SHA1 checksums — those prove the download
 * is uncorrupted; this proves the file still classifies the IPs that the
 * event-process BotDetector keys off (Google/Microsoft/Yahoo mail scanners).
 *
 * Usage:
 *   pnpm tsx scripts/validate-mmdb.ts <mmdb-path> <fixtures-path>
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
  asn?: number;
  user_type?: string;
  asn_org_contains?: string;
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
  traits?: TraitsRaw;
}

const MIN_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_SIZE_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB

function die(code: number, message: string): never {
  process.stderr.write(`validate-mmdb: ${message}\n`);
  process.exit(code);
}

function main(): void {
  const [, , mmdbArg, fixturesArg] = process.argv;
  if (!mmdbArg || !fixturesArg) {
    die(2, 'usage: validate-mmdb.ts <mmdb-path> <fixtures-path>');
  }

  const mmdbPath = resolve(mmdbArg);
  const fixturesPath = resolve(fixturesArg);

  let size: number;
  try {
    size = statSync(mmdbPath).size;
  } catch (err) {
    die(2, `cannot stat MMDB file at ${mmdbPath}: ${(err as Error).message}`);
  }
  if (size < MIN_SIZE_BYTES || size > MAX_SIZE_BYTES) {
    die(
      2,
      `implausible MMDB size: ${size} bytes (expected ${MIN_SIZE_BYTES}..${MAX_SIZE_BYTES})`,
    );
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
