import { LegalPage } from "@/components/site/legal-page";

export default function AccountDeletionHelpPage() { return <LegalPage eyebrow="Account deletion" title="A clear, permanent way to leave Covarify." intro="You can request complete account deletion from your signed-in account. If you want a copy of your information, request it before deleting your account. Deletion is permanent and cannot be undone." sections={[
  { title: "Immediately", body: <p>Your account is disabled, every Plaid institution is disconnected, all Plaid access tokens are permanently destroyed, and Covarify can no longer access your connected institutions.</p> },
  { title: "Within 30 days", body: <p>Covarify removes connected account information, transaction history, your Money Picture, Financial Memory, decision history, and synchronization records.</p> },
  { title: "Limited records", body: <p>Covarify may retain consent records, security audit events, the deletion request, and records required by applicable law. These retained records cannot be used to reconnect to financial institutions or rebuild your financial profile.</p> },
  { title: "Encrypted backups", body: <p>Encrypted backups may temporarily contain historical copies of deleted information. They expire within a maximum of 35 days and are never used to reactivate a deleted account. Deletion requests always take precedence over a restored backup.</p> },
  { title: "Questions", body: <p>For help or to request a copy of your information before deletion, contact <a href="mailto:contact@covarify.com">contact@covarify.com</a>.</p> },
]} />; }
