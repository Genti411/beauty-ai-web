import { parseCatalogQuery } from './query';

describe('parseCatalogQuery', () => {
  it('parses a known category, trimmed search, and page', () => {
    expect(parseCatalogQuery({ category: 'lipstick', search: '  red ', page: '2' })).toEqual({
      category: 'lipstick',
      search: 'red',
      page: 2,
    });
  });

  it('ignores an unknown category', () => {
    expect(parseCatalogQuery({ category: 'perfume' }).category).toBeUndefined();
  });

  it('defaults page to 1 when missing or invalid', () => {
    expect(parseCatalogQuery({}).page).toBe(1);
    expect(parseCatalogQuery({ page: 'abc' }).page).toBe(1);
    expect(parseCatalogQuery({ page: '0' }).page).toBe(1);
  });

  it('treats blank search as undefined', () => {
    expect(parseCatalogQuery({ search: '   ' }).search).toBeUndefined();
  });
});
