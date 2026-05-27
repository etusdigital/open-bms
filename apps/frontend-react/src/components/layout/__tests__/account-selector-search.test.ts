import { describe, it, expect } from 'vitest';

/**
 * Test the accent-insensitive, multi-word search logic used in AccountSelector.
 * Extracted as a pure function test since the actual filtering is inline in the component.
 */
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function filterAccounts(accounts: { name: string; id: number }[], search: string): { name: string; id: number }[] {
  if (!search) return accounts;
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  return accounts.filter((a) => {
    const name = normalize(a.name);
    const id = a.id.toString();
    return terms.every((term) => name.includes(term) || id.includes(term));
  });
}

const accounts = [
  { name: 'CartaoRapido', id: 1 },
  { name: 'Cartao Super', id: 2 },
  { name: 'Cartão feito', id: 3 },
  { name: 'MeuApp', id: 4 },
  { name: 'Promoção Natal', id: 5 },
  { name: 'Promocao Verao', id: 6 },
];

describe('Account search - accent-insensitive multi-word', () => {
  it('matches without accents (cartao matches Cartão)', () => {
    const results = filterAccounts(accounts, 'cartao');
    expect(results.map((a) => a.name)).toEqual(['CartaoRapido', 'Cartao Super', 'Cartão feito']);
  });

  it('matches with accents (Cartão matches all cartao variants)', () => {
    const results = filterAccounts(accounts, 'Cartão');
    expect(results.map((a) => a.name)).toEqual(['CartaoRapido', 'Cartao Super', 'Cartão feito']);
  });

  it('multi-word search requires all terms (AND logic)', () => {
    const results = filterAccounts(accounts, 'cartao super');
    expect(results.map((a) => a.name)).toEqual(['Cartao Super']);
  });

  it('matches by ID', () => {
    const results = filterAccounts(accounts, '4');
    expect(results.map((a) => a.name)).toEqual(['MeuApp']);
  });

  it('is case-insensitive', () => {
    const results = filterAccounts(accounts, 'MEUAPP');
    expect(results.map((a) => a.name)).toEqual(['MeuApp']);
  });

  it('matches promocao without tilde (ç → c)', () => {
    const results = filterAccounts(accounts, 'promocao');
    expect(results.map((a) => a.name)).toEqual(['Promoção Natal', 'Promocao Verao']);
  });

  it('returns all when search is empty', () => {
    const results = filterAccounts(accounts, '');
    expect(results.length).toBe(6);
  });

  it('returns empty for no match', () => {
    const results = filterAccounts(accounts, 'xyz');
    expect(results.length).toBe(0);
  });
});
