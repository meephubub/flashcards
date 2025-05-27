import Script from 'next/script';

export default function AgentPage() {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/gh/logspace-ai/langflow-embedded-chat@v1.0.7/dist/build/static/js/bundle.min.js"
        strategy="afterInteractive"
      />
      <langflow-chat
        window_title="Search agent"
        flow_id="a722ff6b-92bd-4d78-8b0c-c906bd261fe9"
        host_url="https://astra.datastax.com"
      ></langflow-chat>
    </>
  );
}