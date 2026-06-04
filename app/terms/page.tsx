export const metadata = { title: 'Terms of Service — Beauty AI' };

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 760, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 12 }}>
      <p style={{ background: '#fff3cd', padding: 8, borderRadius: 6, fontSize: 13 }}>
        DRAFT — pending legal review. This text describes how the product is built; it is not final legal advice.
      </p>
      <h1>Terms of Service</h1>

      <h2>Using Beauty AI</h2>
      <p>
        Beauty AI provides virtual makeup try-on and product recommendations. You must be 18 or older
        to use the service. You are responsible for the photos you choose to upload.
      </p>

      <h2>Recommendations</h2>
      <p>
        Try-on renders and product suggestions are for illustration only and are not a guarantee of how
        a product will look or perform in person.
      </p>

      <h2>Affiliate relationships</h2>
      <p>
        Some product links are affiliate links; we may earn a commission from qualifying purchases at no
        extra cost to you.
      </p>

      <h2>Accounts &amp; termination</h2>
      <p>
        You may delete your account at any time from your account page. We may suspend accounts that
        misuse the service.
      </p>
    </main>
  );
}
