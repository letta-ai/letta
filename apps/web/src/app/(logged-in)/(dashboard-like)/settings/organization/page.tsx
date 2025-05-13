import { redirect } from 'next/navigation';

function OrganizationsPage() {
  redirect('/settings/organization/account');
}

export default OrganizationsPage;
