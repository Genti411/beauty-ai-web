import { buildExportPayload } from './export';

describe('buildExportPayload', () => {
  it('shapes profile + saved looks into the documented JSON, excluding image bytes', () => {
    const profile = { id: 'u1', display_name: 'Ada', saved_looks_consented_at: '2026-05-01T00:00:00Z' };
    const looks = [
      { id: 'l1', image_path: 'u1/l1.png', picks: [{ id: 'p1' }], created_at: '2026-05-02T00:00:00Z' },
    ];
    expect(buildExportPayload(profile, looks)).toEqual({
      profile: { id: 'u1', display_name: 'Ada', saved_looks_consented_at: '2026-05-01T00:00:00Z' },
      savedLooks: [
        { id: 'l1', image_path: 'u1/l1.png', picks: [{ id: 'p1' }], created_at: '2026-05-02T00:00:00Z' },
      ],
    });
  });

  it('handles a null profile and empty looks', () => {
    expect(buildExportPayload(null, [])).toEqual({ profile: null, savedLooks: [] });
  });
});
