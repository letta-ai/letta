interface BillingLinkProps {
  children: React.ReactNode;
}

export function BillingLink({ children }: BillingLinkProps) {
  return (
    <a
      className="underline"
      target="_blank"
      href="/settings/organization/billing"
    >
      {children}
    </a>
  );
}
