export type ExportProfile = {
  id: string;
  display_name: string | null;
  saved_looks_consented_at: string | null;
};

export type ExportLook = {
  id: string;
  image_path: string;
  picks: unknown;
  created_at: string;
};

export type ExportPayload = {
  profile: ExportProfile | null;
  savedLooks: ExportLook[];
};

// Shape a user's data for the export download. Metadata only — never image bytes.
export function buildExportPayload(
  profile: ExportProfile | null,
  looks: ExportLook[],
): ExportPayload {
  return {
    profile: profile
      ? {
          id: profile.id,
          display_name: profile.display_name,
          saved_looks_consented_at: profile.saved_looks_consented_at,
        }
      : null,
    savedLooks: looks.map((l) => ({
      id: l.id,
      image_path: l.image_path,
      picks: l.picks,
      created_at: l.created_at,
    })),
  };
}
