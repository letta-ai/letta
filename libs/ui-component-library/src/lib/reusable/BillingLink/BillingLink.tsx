interface BillingLinkProps {
  children: React.ReactNode;
}

export function BillingLink({ children }: BillingLinkProps) {
  return (
    <a
      className="underline"
      target="_blank"
      rel="noreferrer"
      href="/settings/organization/usage"
    >
      {children}
    </a>
  );
}
