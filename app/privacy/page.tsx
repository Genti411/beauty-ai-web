export const metadata = { title: 'Privacy Policy — Beauty AI' };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 12 }}>
      <p style={{ background: '#fff3cd', padding: 8, borderRadius: 6, fontSize: 13 }}>
        DRAFT — pending legal review. This text describes how the product is built; it is not final legal advice.
      </p>
      <h1>Privacy Policy</h1>

      <h2>What we collect</h2>
      <p>
        Beauty AI processes a photo you upload entirely in your browser to render makeup try-on
        results. Your original selfie is never uploaded to our servers. If you choose to save a look,
        we store the rendered (makeup-applied) image — which is a biometric image — and the list of
        products in that look.
      </p>

      <h2>Where it is stored</h2>
      <p>
        Saved looks are stored in our database (the <code>saved_looks</code> records) and the rendered
        images in a private, access-controlled storage bucket (<code>look-images</code>), encrypted at
        rest. Each user can access only their own saved looks.
      </p>

      <h2>Consent</h2>
      <p>
        We store a rendered face image only after you give explicit consent the first time you save a
        look. You can withdraw by deleting your saved looks or your account at any time.
      </p>

      <h2>Retention</h2>
      <p>
        Saved looks are retained until you delete them, and are automatically purged after a defined
        retention period of inactivity. Deleting your account removes your profile, saved looks, and
        stored images.
      </p>

      <h2>Your rights</h2>
      <p>
        From your account page you can export your data (a JSON file of your profile and saved-look
        records) and permanently delete your account and all associated data.
      </p>

      <h2>Affiliate links</h2>
      <p>
        Product links may be affiliate links; Beauty AI may earn a commission from purchases made
        through them.
      </p>
    </main>
  );
}
