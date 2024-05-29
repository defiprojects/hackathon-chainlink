import HeroBanner from "../_components/ui/hero-banner";
import ReviewAi from "../_components/ui/review-ai/review-ai";
import SmartContractVulnerabilities from "../_components/ui/smart-contract-vulnerabilities/smart-contract-vulnerabilities";
import SmartContract from "../_components/ui/smart-contract/smart-contract";
import SuggestedChanges from "../_components/ui/suggested-changes/suggested-changes";

export default function AuditPage() {
  return (
    <main className="bg-dark-darkMain min-h-screen px-36 text-white">
      <div className="h-8" />
      <HeroBanner
        title="Your AI auditor"
        text="Your Smart Contracts audited in a matter of seconds."
        img="/auditBanner.png"
        imgAlt="Audit Banner"
        imgWidth={260}
        imgHeight={260}
      />
      <div className="h-8" />
      <SmartContract />
      <div className="h-8" />
      <SmartContractVulnerabilities />
      <div className="h-8" />
      <SuggestedChanges />
      <div className="h-8" />
      <ReviewAi />
      <div className="h-8" />
    </main>
  );
}